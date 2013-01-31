/**
@module Turbo
**/

/* Major Dependencies */

	// Node
var fs = require('fs'),
	path = require('path'),

	// JS Extensions
	_ = require('underscore'),
	classy = require('./classy'),
	Class = classy.Class,
	
	// Specific
	Config = require('./config'),
	Turbo = require('./turbo');

/**
Manages third-party extensions. Only one instance is created per application and it is automatically attached to the main Turbo instance.

	var plugins = Turbo.plugins;

@class Plugins
@static
**/
var Plugins = Class.$extend({

	/**
	Constructs a new Plugin Object. Cannot (and should not) be called directly.
	
	@method __init__
	@param {String} directory A path to the main plugin directory.
	@param {Object} options
		@param {String} options.plugin_file The name of the file to look for in a plugin folder.
		@param {Boolean} options.autoload Automatically load all plugins found in the plugin directory.
	**/
	__init__: function(folder, options) {
		// Enable options
		this.options = _.defaults(options || {}, {
			'plugin_file': 'package.json',
			'autoload': true
		});

		// Make sure folder exists
		if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new Error("Invalid plugins directory.");
		this.location = folder;

		// Basic variable set up
		this.plugins = {};
		
		// If autoload is true
		if (this.options.autoload) {
			// Loop through folder to find valid plugins
			_.each(fs.readdirSync(folder), _.bind(function(item) {
				if (fs.statSync(path.join(folder, item)).isDirectory()) this.require(item);
			}, this));
		}
		
		return this;
	},

	/**
	Retrieves a plugin's metadata, creates a new plugin and caches it. If the plugin already loaded, that is returned instead. This method differs from `Plugin.require()` in that does not bring the plugin into context.
	
	@method load
	@param {String} name The name of the folder the plugin is located in.
	@return {Object} An object containing plugin data.
	**/
	load: function(name) {
		// Check if the plugin exists and return
		if (_.has(this.plugins, name)) return this.plugins[name];
	
		// Check that the plugin primary executable exists
		var folder = path.join(this.location, name),
			file = path.resolve(folder, this.options.plugin_file);
		
		if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new Error("`"+name+"` could not be found in the plugins directory.");
		if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error("No valid `"+this.options.plugin_file+"` could be found in `"+name+"`.");
		
		// Load up a new plugin
		var plugin = this.plugins[name] = { config: new Config(file), context: null };
		
		// Save it's location and dependencies
		var main_file = plugin.config.get("main");
		plugin.file = main_file ? path.resolve(folder, main_file) : null;
		plugin.deps = plugin.config.get("dependencies") || [];
		
		return plugin;
	},
	
	/**
	Uses Node's built in `require()` to execute the main script. Also loads dependencies.
	
	@method require
	@param {String} name The name of the folder the plugin is located in.
	@return {Mixed} Whatever `require()` returns.
	**/
	require: function(name) {
		// Load in the plugin
		var plugin = this.load(name);
		
		// Recursively load dependencies if they aren't already
		_.each(plugin.deps, _.bind(function(dep) {
			if (!_.has(this.plugins, dep)) this.require(dep);
		}, this));
		
		// Test the location
		if (plugin.file) {
			if (!fs.existsSync(plugin.file) || !fs.statSync(plugin.file).isFile()) throw new Error("`"+main_file+"` could not be found.");
			
			// Bring it up to speed
			plugin.context = require(plugin.file);
		}
		
		return plugin;
	}

});

/*
There should really only be one of these per Turbo instance so this will do it's own set up.
*/

// New Plugins Object
var P = new Plugins(Turbo.PATHS.PLUGINS, Turbo.config.get("plugins"));

// Tell Turbo about the instance
Turbo.plugins = P;