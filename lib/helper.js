// This file provides general helper functions

/**
 * Major dependencies
 */

	// Node
var // None

	// JS Extensions
	_ = require('underscore'),
	sugar = require('sugar'),
	
	// Specific
	promise = require('fibers-promise'),
	Turbo = require('./turbo');
	
/**
 * rand_hex( int n )
 *
 * Generates a random hexadecimal string of n digits long
 */
var rand_hex = module.exports.rand_hex = function( n ) {
	if (!n) n = 6;
	var val = "";
	
	_.times(n, function() {
		val += Math.floor(Math.random() * 16).toString(16);
	});
	
	return val;
}

/**
 * generate_uuid( )
 *
 * Generates a new unique identifier. Holds a cache to gaurantee uniqueness.
 * This should only be used for uuid that can be lost on server stop because the cache may be cleared on start.
 */
var generate_uuid = module.exports.generate_uuid = function() {
	var p = promise.t(),
		cache = Turbo.redis,
		uuid = rand_hex(32),
		valid = false;
	
	while (!valid) {
		cache.sismember("__turbo::uuids", uuid, p);
		if (p.get()) uuid = rand_hex(32);
		else valid = true;
	}
	
	cache.sadd("__turbo::uuids", uuid, p);
	return p.get() ? uuid : false;
}

/**
 * patherize( array/string segments, object options )
 *
 * Takes a string or array of strings and converts it into a usable path
 *
 * Options:
 * sep (string) [/] : Path seperator
 * root (bool) [true] : Include the root seperator
 * strict (bool) [false] : Returns null on invalid parts instead of skipping
 * match (regex or function) [sugarjs dasherize] : regex or function to test a segment for validity or replace it
 */
var patherize = module.exports.patherize = function( segments, options ) {
	var loop;
	
	var defs = {
		"cache": { sep: "::", root: false },
		"filesystem": {}
	}
	
	if (_.isString(options) && _.has(defs, options)) options = defs[options];
	if (!_.isObject(options)) options = {};
	
	// Set up options
	_.defaults(options, {
		sep: "/",
		root: true,
		strict: false,
		match: function(seg) { return seg.parameterize(); }
	});
	
	// Validate segments
	if (_.isString(segments)) segments = depatherize(segments, options.sep, true);
	if (!_.isArray(segments)) throw new Error("Segments should be a string or array.");
	
	if (options.strict) loop = _.some;
	else loop = _.each;
	
	// Loop through segments; if it returns true that something went wrong
	if (loop(segments, function(seg, key) {
		var test;
		
		// Make sure segment is a string or get out
		if (!_.isString(seg)) return true;
		
		// Test the segment
		if (_.isRegExp(options.match)) test = seg.match(options.match);
		else if (_.isFunction(options.match)) test = options.match.call(null, seg);
		else test = true;
		
		// If it validates to false
		if (!test) {
			// If strict, gtfo
			if (options.strict) return true;
			
			// Otherwise "mark" for deletion
			segments[key] = null;
		
		// Otherwise test it as a string for replacing
		} else if (_.isString(test)) segments[key] = test;
	})) return null;
	
	// Return a brand new path
	return (options.root ? options.sep : "") + _.compact(segments).join(options.sep);
}

/**
 * depatherize( string path, string sep, bool strict )
 *
 * Takes a string and seperates it into an array of segments
 *
 * Arguments:
 * sep (string) [/] : Path seperator
 * strict (bool) [false] : Returns a segment even if it is blank
 */

var depatherize = module.exports.depatherize = function( path, sep, strict ) {
	// Validate
	if (!_.isString(path)) throw new Error("Path should be a string.");
	if (!_.isString(sep)) sep = "/";
	if (!_.isBoolean(strict)) strict = false;
	
	// Trim the path of starting or ending segments
	path = path.trim();
	if (path.substr(0, sep.length) === sep) path = path.substr(sep.length);
	if (path.substr(-1 * sep.length) === sep) path = path.substr(0, path.length - sep.length);
	
	// Split the path
	var segments = path.split(sep);
	
	// If strict, just return what we found, otherwise compact the array
	if (strict) return segments;
	else return _.compact(segments);
}