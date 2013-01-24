/*
 * * * * *
 * APP Start Point
 * * * * *
 *
 * Declare some basic stuff and go!
 *
 */

var path = require('path'),
	time = new Date();

// Variables to change
var OPTIONS = {

	ENVIRONMENT: "development",

	SYSTEM_PATHS: {

		APP: __dirname,
		LIBRARY: path.join(__dirname, "./lib/"),
		CONFIG: path.join(__dirname, "./config.json"),
		THEME: path.join(__dirname, "./theme/"),
		PLUGINS: path.join(__dirname, "./plugins/"),

	}

};

var Turbo = require('./lib/turbo.js');

Turbo.set_options(OPTIONS);
Turbo.liftoff(function(err) {
	var took = new Date() - time;
	console.log("We have lift off on port " + Turbo.config.get('port')+". Start up took "+took+" ms.");
});