/**
 * Major dependencies
 */

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
 * Plugins Object
 */

// Go
var Plugins = Class.$extend({

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

	require: function(name) {
		// Check that the plugin primary executable exists
		var folder = path.join(this.location, name),
			file = path.resolve(folder, this.options.plugin_file);
		
		if (!fs.existsSync(file)) throw new Error("`"+name+"` plugin could not be found in the plugins directory.");
		
		// Load up a new plugin
		var plugin = this.plugins[name] = { config: new Config(file), context: null };
		
		// Save it's location and dependencies
		var main_file = plugin.config.get("main");
		plugin.file = main_file ? path.resolve(folder, main_file) : null;
		plugin.deps = plugin.config.get("dependencies") || [];
		
		// Recursively load dependencies
		_.each(plugin.deps, _.bind(function(dep) { this.require(dep); }, this));
		
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
 * There should really only be one of these per Turbo instance
 * So this will do it's own set up
 */

// New Plugins Object
var P = new Plugins(Turbo.defaults().SYSTEM_PATHS.PLUGINS, Turbo.config.get("plugins"));

// Tell Turbo about the instance
Turbo.plugins = P;