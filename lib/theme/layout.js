/**
 * Major dependencies
 */

	// Node
var path = require('path'),
	fs = require('fs'),
	url = require('url'),

	// JS Extensions
	_ = require('underscore'),
	classy = require('../classy'),
	Class = classy.Class,
	EventClass = classy.EventClass,
	
	// Specific
	promise = require('fibers-promise'),
	Config = require('../config'),
	Asset = require('./asset'),
	helper = require('../helper');

/**
 * Layout Class
 */
 
var Layout = EventClass.$extend({
	
	__init__: function( name, options ) {
		var p = promise.t();
		
		// Call to super first so events are properly initialized
		this.$super();
		
		// Load the options
		this.options = _.defaults(options || {}, {
			concat: false
		});
		
		// Load some vars
		this.name = name || null;
		this.asset_groups = {};
		this.actions = {};
		this.state = "initial";
		this.public_url = null;
		
		// Generate a UUID
		this.uuid = helper.generate_uuid();
	},
	
	// public_url is a function that when given an asset can produce a path
	// Generally, you're not going to want to set this because connect.js does automatically
	// This function sets it
	set_public_url: function( fnc ) {
		if (_.isFunction(fnc)) this.public_url = fnc;	
	},
	
	change_states: function( state ) {
		// Validate
		if (!_.isString(state)) throw new Error("State should be a string.");
		
		// Get the old, set the new
		var old = this.state;
		this.state = state;
		
		// Trigger an action
		this.trigger("state_change", state, old);
	},
	
	// Actions do things with layouts
	register_action: function( action, fnc ) {
		// Validate
		if (!_.isString(action)) throw new Error("Action should be a string.");
		if (!_.isFunction(fnc)) throw new Error("Callback should be a function.");
		
		// Set it
		this.actions[action] = _.bind(fnc, this);
	},
	// Runs an action with options
	do_action: function( action, options ) {
		// Check that the name exists
		if (!_.has(this.actions, action)) throw new Error("An action by that name couldn't be found.");
		
		// Normalize options
		if (!_.isObject(options)) options = {};
		
		// Execute
		if (_.isFunction(this.actions[action])) return this.actions[action].call(this, options);
	},
	
	// Asset groups; a list of assets and their strategy for compilation
	// Register a group and its strategy; should be called before `add_asset` although that doesn't matter
	register_group: function(group, fnc) {
		// Check if the group exists
		if (!_.has(this.asset_groups, group)) this.asset_groups[group] = { assets: [], strategy: null };
		
		// Set the strategy
		if (_.isFunction(fnc)) this.asset_groups[group].strategy = fnc;
	},
	// Unregistering a group removes it from context
	unregister_group: function(group) {
		// Check that the name exists
		if (!_.has(this.asset_groups, group)) throw new Error("An asset group by that name couldn't be found.");
		
		// Loop through group, destroying assets
		_.each(this.asset_groups[group].assets, function(asset) { asset.destroy(); });
		
		// Remove the group from the layout
		delete this.asset_groups[group];
	},
	// Execute a strategy on a group
	execute: function(group, options) {
		// Check that the name exists
		if (!_.has(this.asset_groups, group)) throw new Error("An asset group by that name couldn't be found.");
		var grp_data = this.asset_groups[group], ret;
		
		// Normalize options
		if (!_.isObject(options)) options = {};
		
		// Before strategy event
		this.trigger("before_strategy", grp_data.assets, options);
		
		// Find and execute the strategy; return that
		if (_.isFunction(grp_data.strategy)) ret = grp_data.strategy.call(this, grp_data.assets, options);
		
		// Or return undefined meaning that no group strategy was set
		else ret = undefined;
		
		// After strategy event
		this.trigger("after_strategy", ret, options);
		
		return ret;
	},
	
	// Add an asset to a group
	add_asset: function( group, asset ) {
		// Check if the asset group exists, or register
		if (!_.has(this.asset_groups, group)) this.register_group(group);
		
		// If asset is an array, add recursively
		if (_.isArray(asset)) _.each(asset, _.bind(function(item) { this.add_asset(group, item) }, this));
		
		// Asset?
		else if (asset instanceof Asset) {
			// Attach the asset's group name; this is not normal and shouldn't be relied on
			asset.group = group;
			
			// Push it
			this.asset_groups[group].assets.push(asset);
		
		// Or throw an Error
		} else throw new Error("Second argument should be an Asset or an array of Assets.");
	},
	// Get an asset(s); return undefined if nothing is found
	get_asset: function(group, name) {
		// Check that there is a group by that name
		if (!_.has(this.asset_groups, group)) throw new Error("An asset group by that name couldn't be found.");
		
		var assets = this.asset_groups[group].assets;
		
		// No name? return all assets
		if (_.isUndefined(name)) return assets;
		
		// String? check the asset names
		else if (_.isString(name)) return _.find(assets, function(asset, i) {
			if (asset.name === name) return true;
		});
	},
	// Remove one asset, by name, from the group
	remove_asset: function(group, name) {
		var index, asset;
		
		// Check that there is a group by that name
		if (!_.has(this.asset_groups, group)) throw new Error("An asset group by that name couldn't be found.");
		
		// Find the asset
		asset = _.find(this.asset_groups[group].assets, function(asset, i) {
			if (asset.name === name) {
				index = i;
				return true;
			}
		});
		if (!asset) return;
		
		// Remove it from the layout
		this.asset_groups[group].assets.splice(i, 1);
	},
	// Remove all assets in a group
	remove_assets: function(group) {
		// Check that there is a group by that name
		if (!_.has(this.asset_groups, group)) throw new Error("An asset group by that name couldn't be found.");
		
		// Reset the assets array
		this.asset_groups[group].assets = [];
	},
	
	// Attempt to turn everything into something we can send to the browser
	compile: function(context, options) {
		// Validate
		if (!_.isObject(context)) throw new Error("Context should be an object.");
		if (!_.isObject(options)) options = {};
			
		// Test the state. If it's initial, precompile
		if (this.state === "initial") this.do_action("precompile");
		
		// Make sure we are in a ready state
		if (this.state !== "ready") throw new Error("Can't compile this layout until it's state is \"ready\".");
		
		// Wrap the context into the options without destroying anything
		if (_.isObject(options.content)) {
			if (_.isObject(options.content.context)) _.extend(options.content.context, context);
			else options.content.context = context;
		} else options.content = { context: context };
		
		// Run and return
		return this.do_action("compile", options);
	},
	
	// "Internal" methods
	
	// Parse options given to Layout compilation functions
	parse_options: function() {
		// Get parts, validate arguments
		var parts = _.keys(this.asset_groups),
			objs = _.flatten(_.toArray(arguments)),
			options = {};
		
		_.each(objs, function(obj) {
			// Divide the options into what's important
			var important = _.pick(obj, parts),
				extra = _.omit(obj, parts);
			
			// Loop back through parts, adding additional stuff
			_.each(parts, function(key) {
				// Get exact value first
				var value = _.has(important, key) && _.isObject(important[key]) ? important[key] : {};
				
				// Mash it all together
				value = _.extend({}, extra, value);
			
				// Set it; use defaults to prevent overwriting
				if (!options[key]) options[key] = {};
				_.defaults(options[key], value);
			});
		});
		
		return options;
	}
	
});

module.exports = Layout;