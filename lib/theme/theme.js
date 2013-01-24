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
	Config = require('../config'),
	Asset = require('./asset'),
	Layout = require('./layout');

/**
 * Main Theme Class
 */

var Theme = EventClass.$extend({
	
	__init__: function(folder, options) {
		// Call to super first so events are properly initialized
		this.$super();
		
		// Load the options
		this.options = _.extend({
			config_file: 'theme.json', // Theme config file name
			setup: './setup.js', // Basic setup file location relative to this file, set to false for nothing
			globals: './assets/globals.json', // Global assets declaration file
			static_files: './', // Base path, relative to theme location, for static assets
			
			// Other random crap not necessarily used by this
			minify: false,
			concat: false
		}, options || {});
		
		// theme config file location
		var file = path.resolve(folder, this.options.config_file);

		// If there is no theme file get out!
		if (!fs.existsSync(file)) throw new Error("No "+this.options.config_file+" found in `"+folder+"`");
		this.location = folder;
		
		// Load up the theme config just for us ^_^
		this.config = new Config(file);
		
		// Other random vars
		this.global_assets = new Config(path.resolve(__dirname, this.options.globals));
		this.strategies = {};
		this.asset_types = {};
		this.actions = {};
		
		// And give this theme some defaults so it's not such a skinny bitch
		if (this.options.setup) require(this.options.setup)(this);
		
		// Now that it's setup, finish it
		this._process_config();
	},
	
	// give it an array of assets and it'll spit out some data
	// This also has asset group ids for theme config parsing
	// These are globals that get injected into a Layout object; they shouldn't be executed from the Theme
	register_strategy: function(name, fnc) { // Name is an asset group name (ie scripts)
		this.strategies[name] = fnc;
	},
	
	// States modify a layout permanently
	// These are globals that get injected into a Layout object; they shouldn't be executed from the Theme
	register_action: function( action, fnc ) {
		this.actions[action] = fnc;
	},
	
	// Base asset types; this is a helper to convert extensions into asset types
	// It also has a "global" asset filter than gets passed to a Layout
	// These are globals that get injected into a Layout object; they shouldn't be executed from the Theme
	register_asset_type: function(type, exts, prefilter) {
		// If the type doesn't exist, make a new one
		if (!_.has(this.asset_types, type)) this.asset_types[type] = { extensions: [], prefilter: null };
		var at = this.asset_types[type];
	
		// Let's deal with the arguments, this could receive several things
		if (_.isFunction(exts)) {
			prefilter = exts;
			exts = [];
		}
		
		// Is ext an array? recursively add
		if (_.isArray(exts)) _.each(exts, _.bind(function(item) { this.register_asset_type(type, item) }, this));
		// Otherwise, if it is a string, do a union
		else if (_.isString(exts)) at.extensions = _.union(at.extensions, [ exts ]);
		
		// Push the filter
		if (_.isFunction(prefilter)) at.prefilter = prefilter;
	},
	extension_type: function(ext) {
		var ret = null;
		_.some(this.asset_types, function(item, key) {
			var exts = item.extensions;
			if (_.some(exts, function(a_ext) {
				return a_ext === ext;
			})) {
				ret = key;
				return true;
			}
		});
		return ret;
	},
	// When an asset is created, this function is run on it.
	prefilter: function(asset) {
		// Validate asset as the correct type
		if (!(asset instanceof Asset)) throw new Error("First argument should be an Asset.");
		
		// Find and execute the filter base on asset type; return that
		if (asset.type &&
			_.has(this.asset_types, asset.type) &&
			_.isFunction(this.asset_types[asset.type].prefilter)) return this.asset_types[asset.type].prefilter.call(this, asset);
		
		// Or return the asset
		else return asset;
	},
	
	// Takes a template ID and returns a new Layout object
	new_layout: function(template_name, options) {
		if (!this.config) return false;
		
		// Validate arguments
		if (!_.isString(template_name)) throw new Error("Template ID should be a string.");
		
		// Get template and verify
		var template = this.config.get("templates", template_name);
		if (!_.isObject(template)) throw new Error("No template found with that ID in the theme config file.");
		
		// Get layout data
		var layout_data = this.config.get("layouts", template.layout);
		if (!layout_data) layout_data = {};
		
		// New Layout object with any options
		options = _.defaults(options || {}, {
			concat: this.options.concat
		});
		var layout = new Layout(template_name, options);
		
		// Next let's add any global actions
		_.each(this.actions, function(fnc, name) { layout.register_action(name, fnc); });
		
		// ... and any global strategies
		_.each(this.strategies, function(fnc, name) { layout.register_group(name, fnc); });
		
		// Cycle through strategies for asset group names
		_.each(this.strategies, _.bind(function(fnc, group) {
			// Load the assets; Order matters
			var lag = _.has(layout_data, group) ? layout_data[group] : null, lao = [[],[]],
				tag = _.has(layout_data, group) ? template[group] : null, tao = [];
				
			// Let's turn config data into real assets
			if (lag) lao = this._process_asset_group(lag, true);
			if (tag) tao = this._process_asset_group(tag);
			
			// Let's create 'union' of all assets and add it to the layout
			layout.add_asset(group, _.union(lao[0], tao, lao[1]));
		}, this));
		
		/*// Next let's add any global filters...
		_.each(this.asset_types, function(item, type) {
			// Only add if it can to prevent errors.
			if (_.isFunction(item.filter)) layout.register_filter(type, item.filter);
		});*/
		
		// New Layout Event
		this.trigger("new_layout", layout);
		
		// Return one sexy layout
		return layout;
	},
	// Create a new layout from the type and template if it can be found
	new_layout_by_type: function(type, template_name, options) {
		// Validate arguments
		if (!_.isString(type)) throw new Error("Type should be a string.");
		if (_.isObject(template_name)) {
			options = template_name;
			template_name = null;
		}
		
		// First test the template
		try { return this.new_layout(template_name, options); }
		catch (e) { }
		
		// Next, search through templates to locate a good type
		var templates = this.config.get("templates"),
			the_key = null;
		
		_.find(templates, function(template, key) {
			if (template.type === type) {
				the_key = key;
				return true;
			}
		});
		
		return the_key ? this.new_layout(the_key, options) : null; 
	},
	
	// Take a string or object and returns an asset
	new_asset: function(asset, base_path) {
		var ext, file, filename, type, uri, global;
		
		// Set the "relative too" path if it isn't set
		if (!base_path) base_path = this.location;
		
		// First let's check if everything generic should be a static url
		if (this.config.get("options", "static_assets") === true) type = "static";
		
		// Now let's see if the asset is really an ID to a global asset
		if (_.isString(asset)) global = this.global_assets.get(asset);
		// Do a small recursion to get the correct data
		if (global) return this.new_asset(global, path.resolve(__dirname, "assets"));
		
		// If it's not a global, do normal stuff
		// First find and parse the url
		if (_.isString(asset)) filename = asset;
		else if (_.isObject(asset) && _.has(asset, "file")) filename = asset.file;
		if (filename) uri = url.parse(filename);
		
		// Check the uri
		if (_.isObject(uri)) {
			// Find the extension
			if (_.has(uri, "pathname") && !_.isEmpty(uri.pathname)) ext = path.extname(uri.pathname).substr(1);
			
			// Make sure the type isn't static before we adjust
			if (type !== "static") {
				// Validate the uri as local and correct it
				if (!_.has(uri, "host") && ext) file = path.resolve(base_path, uri.pathname);
				
				// Otherwise it's an external url or nothing useful
				else if (_.has(uri, "host")) file = url.format(uri);
			
			// Otherwise assume the item is a 'static' path
			} else file = filename;
		}
		
		// Normalize the item if it's not an object
		if (!_.isObject(asset)) {
			// No file? Item must be content.
			if (!file) asset = { content: asset };
			else asset = { content: null };
		
		// Otherwise, force the file name
		} else _.extend(asset, { file: file || null });
		
		// Let's determine the file's type if it's not already 'static'
		// If it's already in the object, it will get used as a default later
		// First, check the extension
		if (!type && ext) type = this.extension_type(ext);
		
		// If the ext failed, load the theme default
		if (!type) type = this.config.get("options", "default_asset_type");
		
		// Setup ConfigAssetObject with defaults
		var ao = _.extend({
			file: file || null,
			content: null,
			type: type || null
		}, asset);
		
		var ass = new Asset(ao);
		
		// Run asset prefilter
		ass = this.prefilter(ass);
		
		// Run new asset action
		this.trigger("new_asset", ass);
		
		return ass;
	},
	
	// Create an asset from a file in the "static" directory
	new_static_asset: function(route) {
		var route = path.resolve(this.location, this.options.static_files, route);
		return fs.existsSync(route) ? this.new_asset(route) : null;
	},
	
	// "Internal" Methods 
	
	// Process the layouts and templates in the theme config
	_process_config: function() {
		// Set some basic options
		var sf = this.config.get("options", "static_files");
		if (sf) this.options.static_files = sf;
		
		// Process global assets
		
	},
	
	// Process the config asset group
	_process_asset_group: function(assets, is_layout) {
		// Validate assets; make sure they aren't falsy
		if (!assets) throw new Error("Incorrect argument type for assets.");
		
		var before = [], b = [],
			after = [], a = [],
			self = this;
		
		// Test for a layout object
		if (_.isObject(assets) && _.has(assets, "before") && _.has(assets, "after")) {
			before = assets.before;
			after = assets.after;
		
		// Or set before to assets
		} else {
			before = assets;
		}
		
		// If before or after isn't an array, push it
		if (!_.isArray(before)) before = [ before ];
		if (!_.isArray(after)) after = [ after ];
		
		// Now lets make some asset objects
		_.each(before, function(item) { b.push(self.new_asset(item)); });
		_.each(after, function(item) { a.push(self.new_asset(item)); });
		
		if (is_layout) return [ b, a ];
		else return b;
	}
	
});

module.exports = Theme;