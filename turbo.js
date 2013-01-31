/**
Responsible for handling the core of Turbo.

@module Turbo
@main Turbo
**/

/*  Major Dependencies */

	// Node
var // None

	// JS Extensions
	_ = require('underscore'),
	classy = require("./classy"),
	Class = classy.Class,
	
	// Specific
	promise = require('fibers-promise'),
	helper = require('./helper'),
	Config = require('./config');

/* Super Protected Configuration Setup */
var defaults = {
	ENVIRONMENT: ["string", "development"],
	SYSTEM_PATHS: {
		APP: ["string", null, true],
		LIBRARY: ["string", __dirname],
		CONFIG: ["string", null, true],
		THEME: ["string", null, true],
		PLUGINS: ["string", null, true],
	}
};

var configuration = {};

/**
The main Turbo class. Manages literally *everything*.

	var Turbo = require('turbo');

@class Turbo
**/
var Turbo = Class.$extend({

	/**
	Sets Turbo's initial, base configuration. This includes things like the envirnoment type and base system paths. This function can only be executed once to protect the base options. 
	
	@method set_options
	@param {Object} options
	@example
		Turbo.set_options({
			ENVIRONMENT: "development",
			SYSTEM_PATHS: {
				APP: __dirname,
				CONFIG: path.join(__dirname, "./config.json"),
				THEME: path.join(__dirname, "./theme/"),
				PLUGINS: path.join(__dirname, "./plugins/"),
			}
		});
	**/
	set_options: _.once(function(options) {
		// Parse and set options
		configuration = helper.parse_options(options, defaults);
		
		// Set some basic ones
		if (configuration.ENVIRONMENT) process.env.NODE_ENV = configuration.ENVIRONMENT;
		this.PATHS = configuration.SYSTEM_PATHS;
	
		// Load the config
		this.config = new Config(this.PATHS.CONFIG);
	}),
	
	/**
	Retrieves a copy of the base configuration.
	
	@method defaults
	**/
	defaults: function() {
		// Clone to protect
		return _.clone(configuration);
	},
	
	/**
	Starts Turbo's main engines. Loads up everything from the database to the Theme engine.
	
	@method liftoff
	@param {Function} [callback] A function to call when Turbo has successfully left the ground (ie launched).
	@example
		Turbo.liftoff(function(err) {
			console.log("We have lift off on port " + Turbo.config.get('port') + ".");
		});
	**/
	liftoff: function(callback) {
		// Make everything run in a Fiber
		promise.start(function() {
			// Run startup
			return require('./startup.js')(callback);
		});
	}

});

// Return a single instance to be used everywhere
module.exports = new Turbo();