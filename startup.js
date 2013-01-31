/*
This file loads everything into the main Turbo instance.
It also prepares Turbo for shutdown.
*/

// Load some major dependencies
var express = require('express'),
	promise = require('fibers-promise'),
	mongoose = require('mongoose'),
	redis = require('redis'),
	path = require('path'),
	http = require('http'),
	_ = require('underscore');

// Internal Dependencies
var Turbo = require('./turbo'),
	Config = require('./config');

// Go!
module.exports = (function() {
	return function(callback) {
		// Load the mongo database
		var mgd = Turbo.config.get("mongo");
		mongoose.connect("mongodb://"+mgd.username+":"+mgd.password+"@"+mgd.host+":"+mgd.port+"/"+mgd.name);
		Turbo.mongo = mongoose.connection;

		// Load the redis server
		var red = Turbo.config.get("redis"),
			rclient = Turbo.redis = redis.createClient(red.port, red.host);

		if (red.password) rclient.auth(red.password);
		
		// Flush the redis cache to ensure a blank state
		rclient.flushall();

		// Load the theme and router
		// They have their own set up to interact
		require('./connect');

		// Load plugins, one instance to rule them all
		require('./plugins');

		// Start engines
		Turbo.router.start(callback);
		
		// Listen for a full on shutdown
		process.once('SIGUSR2', function() {
			// Close the router
			Turbo.router.close();
			
			// Close Redis
			Turbo.redis.quit();
			
			// Finally kill this
			process.kill(process.pid, 'SIGUSR2');
		});
	}
})();