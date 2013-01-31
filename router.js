/**
@module Router
**/

/* Major Dependencies */

	// Node
var fs = require('fs'),
	path = require('path'),
	http = require('http'),
	url = require('url'),

	// JS Extensions
	sugar = require('sugar'),
	_ = require('underscore'),
	classy = require('./classy'),
	Class = classy.Class,
	EventClass = classy.EventClass,
	
	// Specific
	promise = require('fibers-promise'),
	mongoose = require('mongoose'),
	express = require('express'),
	helper = require('./helper'),
	Turbo = require("./turbo");

/**
This object is attached to the request object on an incoming HTTP Request. It provides basic route data as well as some extended utility.

	var route = req.route;

@class Route
@extends Class
@static
**/
var Route = Class.$extend({

	/**
	Constructs a new Route Object. Should not be called directly.
	
	@private
	@method __init__
	@param {String} [pathname] The pathname portion of a URL.
	**/
	__init__: function(pathname) {
		
		/**
		The pathname portion of the current URL.
		
		@property pathname 
		@type String
		**/
		this.pathname = pathname || "";
		
		/**
		The string or regular expression used to match this URL. If it is a string, it should be the identical to `pathname`.
		
		@property handle 
		@type String|RegExp
		**/
		this.handle = null;
		
		/**
		The route type. This is usually defined and controlled by `Router.register_forward()`.
		
		@property type 
		@type String
		@default "system"
		**/
		this.type = "system";
		
		/**
		Extra data associated with this Route including data found in a matching MongoDB document.
		
		@property data 
		@type Mixed
		**/
		this.data = null;
		
		/**
		Key/Value pair of parsed url segments. Only valid on system routes that use the Express.js route format.
		
		@property params 
		@type Mixed
		@example
			Route.handle = "/some/:id/path"
			Route.pathname = "/some/123/path"
			Route.params = { id: 123 }
		**/
		this.params = {};
		
		/**
		The match array produced when `pathname` is matched to a regular expression `handle`.
		
		@property match 
		@type Array
		**/
		this.match = null;

		// Render some segments if we can
		this._render_segments();
	},

	/**
	Retrieves the URL segment value at a specified key in `pathname`. Only valid on system routes that use the Express.js route format. Same as `this.params[key]`.
	
	@method param
	@param {String} key The key to search for in `this.params`.
	@return {String} The matched URL segment or undefined if not found.
	**/
	param: function(key) {
		if (_.isObject(this.params) && _.has(this.params, key)) return this.params[key];
	},

	/**
	Retrieves the URL segment at specific index in `pathname`.
	
	@method segment
	@param {Number} n The index of the segment to retrieve. The first index is 1.
	@return {String} The matched URL segment or undefined if not found.
	@example
		Route.pathname = "/my/awesome/path"
		Route.segment(2) -> "awesome"
	**/
	segment: function(n) {
		n -= 1; // Normalize n
		return this.segments[n] ? this.segments[n] : undefined;
	},
	
	/**
	A quick method for redirecting the end user to an error page. This causes the same effect as `throw new Error()`.
	
	@method throw_error
	@param {String} message The reason this error is being thrown.
	@param {Number} [status=500] The HTTP status code associated with this error.
	**/
	throw_error: function(message, status) {
		this.data.status = status || 500;
		throw new Error(message);	
	},

	/**
	Sets `pathname`, `handle`, `type`, and `data` route properties.
	
	@private
	@method _load
	@param {String|Object} key The internal route key to set. If an object is given, this method is recursively called with it's keys/values.
	@param {Mixed} value The value for the property. Ignored if `key` is an Object.
	@chainable
	**/
	_load: function(key, value) {
		if (_.isObject(key)) {
			_.each(key, _.bind(function(v, k) {
				this._load(k, v);
			}, this));
		} else {
			var valid = ["pathname", "handle", "type", "data"];
			if (_.indexOf(valid, key) !== -1) this[key] = value;
			
			// Rerender the segments if we should
			if (key === "pathname") this._render_segments();
		}
			
		// For chaining
		return this;
	},

	/**
	Seperates `pathname` and stores segments into  `this.segments`. Internally uses `helper.depatherize()`.
	
	@private
	@method _render_segments
	**/
	_render_segments: function() {
		if (!this.pathname) return;
		this.segments = helper.depatherize(this.pathname, "/", true);
	},

	/**
	This function takes an array of specified keys and a regular expression match array and combines them.
	
	@private
	@method _load_params
	@param {Array} keys An array of strings. Express will usually generate this when it parses a route.
	@param {Array} match The regular expression match data. Each match index, `$n`, is paired to the `keys` index `[n-1]`.
	@chainable
	**/
	_load_params: function(keys, match) {
		// Validate
		if (!_.isArray(keys) || !_.isArray(match)) throw new Error("Both arguments should be arrays.");

		// Filter for only the match results
		var matches = _.filter(match, function(item, key) { if (key) return true; }); 

		// Make the params object, it's a little funky
		_.each(keys, _.bind(function(key, i) {
			this.params[key] = matches[i] ? matches[i] : null;
		}, this));

		// Finally load match
		this.match = match;

		// For chaining
		return this;
	}
});

/**
This object manages all traffic flow through Turbo. Technically, it's a complicated wrapper for Express.

	var Router = require("turbo/route");	// Base Router Class
	var router = Turbo.router;				// Main Router instance used by Turbo

@class Router
@extends Class
@constructor
@param {Object} options Base options to help the Router start.
	@param {String} [options.logger='dev'] The [Connect logger middleware](http://www.senchalabs.org/connect/middleware-logger.html) log format.
	@param {String} [options.collection='routes'] The name of the MongoDB collection that Router uses to store static routes. It is generally reccomended that you change this to prevent sharing data with other instances.
	@param {Number} [options.port=9000] The port to start the new Express server on. If the port is taken, an exception is thrown.
	@param {String} [options.cache_key='routes'] The namespace used for storing data in the cache. It is generally reccomended that you change this to prevent sharing data with other instances.
	@param {Function} [options.error_handler] A function to execute if an exception is thrown. Works the same as Connect's error handling (see the [Express Guide on Error Handling](http://expressjs.com/guide.html#error-handling)) except `req.route` is an instance of `Route`.
**/
var Router = EventClass.$extend({

	// Initialize
	__init__: function(options) {
		// Call to super first so events are properly initialized
		this.$super();

		// Load the options
		this.options = _.defaults(options || {}, {
			logger: 'dev',															// Connect logger format
			collection: 'routes',													// MongoDB collection handle
			port: 9000,																// HTTP server port
			cache_key: 'routes',													// Name of cache
			error_handler: function(err, req, res, next) { res.end(err.message); }	// Basic error handling
		});

		// Open routes collection
		var schema = new mongoose.Schema({
			handle: mongoose.Schema.Types.Mixed,
			type: String,
			data: mongoose.Schema.Types.Mixed
		}, { collection: this.options.collection });

		this.routes = mongoose.model('Route', schema);
		
		// Basic vars
		this.cache = Turbo.redis;
		this.forwards = {};
		this.system_routes = [];

		// Initialize express
		var app = this.app = express();
		app.use(express.logger(this.options.logger));	// Basic logging
		app.use(express.bodyParser());					// REQUEST parser
		app.use(express.query());						// GET parser
	},

	/**
	Loads Connect middleware using [Express#app.use()](http://expressjs.com/api.html#app.use). This method is destroyed when the server is started.
	
	@method use
	@param {String} [path='/'] The path to mount the middleware.
	@param {Function} middleware The Connect middleware function.
	**/
	// Load some middleware
	// This function is destroyed on server start
	use: function() {
		return this.app.use.apply(this.app, arguments);
	},

	/**
	Register a new Router forward. When the Router matches a route to a MongoDB document, it executes the forward that matches the document's `type`.
	
	@method register_forward
	@param {String} type The exact type to match when comparing a static route.
	@param {Function} callback The function to call when a document has this `type`.
	**/
	// Forwards are callbacks for paths in the database, matched by their type
	register_forward: function(type, fnc) {
		// Validate and push
		if (_.isString(type) && _.isFunction(fnc)) this.forwards[type] = fnc;
	},

	// System paths are declared by JS, can be "dynamic"
	register_system_route: function(route, fnc) {
		var keys = [];

		// Validate the function or toss a wrench
		if (!_.isFunction(fnc)) throw new Error("Second argument should be a function.");

		// First, let's deal with the route.
		// Is it a string? Convert to regex.
		if (_.isString(route)) route = helper.path_regex(helper.patherize(route, "url"), keys);
		if (!_.isRegExp(route)) throw new Error("First argument should be a path string or regex.");

		// Compose and push the system route
		this.system_routes.push({ handle: route, params: _.pluck(keys, "name"), callback: fnc });
	},

	// Finds the proper route and returns a route object
	get_route: function(route) {
		var p = promise.t(),
			R = new Route(route),
			clr, sr, match, matches,
			params = {},
			exactq = { handle: route },
			fields = { _id: 0, type: 1, handle: 1, data: 1 };

		// Clean and validate the route
		route = helper.patherize(url.parse(route).pathname, "route");
		if (!route) return R._load("type", "error")._load("data", { title: "Bad Request", status: 400, message: "An invalid route was given." });
		
		// Reset the pathname in R in case it was changed.
		R._load("pathname", route);

		// First check system routes for a match
		if (_.size(this.system_routes)) {
			sr = _.find(this.system_routes, function(item) {
				// Try the handle for a match
				match = item.handle.exec(route);

				// If there's a match, do stuff
				if (match) {
					R._load_params(item.params, match);
					return true;
				} else return false;
			});

			if (sr) return R._load("type", "system")._load("handle", sr.handle)._load("data", sr.callback);
		}

		// Next check the database for a perfect match
		this.routes.count(exactq, p);
		if (p.get()) {
			this.routes.findOne(exactq, fields, p);
			var r = _.pick(p.get(), "handle", "type", "data");
			return R._load(r);
		}

		// Otherwise return an error route
		return R._load("type", "error")._load("data", { title: "Not Found", status: 404, message: "Not found." });
	},
	
	cache_route: function(route, content, headers, expires) {
		var p = promise.t();
		
		// Validate
		if (!_.isString(route)) throw new Error("Route should be a string.");
		
		if (_.isString(content)) content = new Buffer(content);
		if (!Buffer.isBuffer(content)) throw new Error("Content should be a buffer or string.");
		
		if (_.isNumber(headers)) {
			expires = headers;
			headers = {};
		}
		if (_.isString(headers)) headers = { "Content-Type": headers };
		if (!_.isObject(headers)) headers = {};
		if (!_.isNumber(expires)) expires = null;
		
		// Create a cache info
		var location = this.build_cache_location(route),
			data = _.chain({}).extend(headers, { content: content.toString('base64') }).map(function(val, key) {
				return [key, val];
			}).flatten().value();
		
		// Set
		data.unshift(location);
		this.cache.hmset(data, p);
		p.wait();
		
		if (expires) this.cache.expire(location, expires);
		
		return p.get() ? true : false;
	},
	
	get_cached_route: function(route) {
		var p = promise.t();
		
		// Validate
		if (!_.isString(route)) throw new Error("Route should be a string.");
		
		// Create a cache location
		var location = this.build_cache_location(route);
		
		// Get
		this.cache.hgetall(location, p);
		var data = p.get();
		
		if (data) {
			var content = _.has(data, "content") ? new Buffer(data.content, "base64") : "",
				headers = _.omit(data, "content");
			
			return { content: content, headers: headers };
		} else return null;
	},
	
	build_cache_location: function(route) {
		route = helper.depatherize(route);
		return helper.patherize(_.union(["__turbo", "routes"], route), "cache");
	},

	// Route logic
	load: function(req, res, next) {
		// FIIIIIIBBBEEEERRRRRR UUUUUPPPP!!!!
		promise.start(_.bind(function() {
			// Catch all for errors
			try {
				// Fire the load event
				this.trigger("load", req, res);

				// Current pathname
				var pathname = req.url;

				// Check the cache first
				var cached = this.get_cached_route(pathname);
				if (cached) {
					res.set(cached.headers);
					return res.send(cached.content);
				}

				// Otherwise get it the long way
				var route = req.route = this.get_route(pathname);
				
				// Decide what to do with this route
				switch (route.type) {
					// System route
					case "system":
						// Call the attached callback
						route.data.call(this, req, res, next);
						break;

					// Some error (can only be a 404 for now)
					case "error":
						// Create an error then toss it
						throw new Error(route.data.message);
						break;

					// Everything else
					default:
						// Check the type against the forwards and execute
						if (_.has(this.forwards, route.type)) this.forwards[route.type].call(this, req, res, next);
						else throw new Error("No forward setup for `"+route.type+"`");
						break;
				}
			} catch (e) {
				// Error event
				this.trigger("load_error", e);

				// Redirect errors to the right place
				next(e);
			}
		}, this));
	},
	
	// Fire up the router!
	start: function(cb) {
		// Some final connect stuff
		this.use(_.bind(this.load, this));
		this.use(this.options.error_handler);

		// Destroy `use` method so it can't be accessed again
		this.use = function() {};

		// Add callback to events
		if (typeof cb === "function") this.on("start", cb);

		// Make sure port is a number to prevent other uses of `server.listen`
		if (typeof this.options.port !== "number") throw new Error("Router starting port should be a number.");

		// New HTTP Server
		var server = this.server = http.createServer(this.app);

		// Server starting event
		this.trigger("starting");

		// Start listening
		server.listen(this.options.port, _.bind(function(err) {
			// Server started event
			this.trigger("start", err);
		}, this));
	},
	
	// Graceful shutdown
	close: function() {
		this.server.close();
		
		this.trigger("close");
	}
	
});

module.exports = Router;