var _ = require('underscore'),
	promise = require('fibers-promise');

// Super protected
var defaults = {
	ENVIRONMENT: ["string", "development"],
	SYSTEM_PATHS: {
		APP: ["string", null, true],
		LIBRARY: ["string", null, true],
		CONFIG: ["string", null, true],
		THEME: ["string", null, true],
		PLUGINS: ["string", null, true],
	}
};

var parse_options = function(options, def) {

	if (typeof options !== "object") throw new Error("Invalid options argument.");

	_.each(def, function(item, key) {
		
		// Array? Then it wants to set up.
		if (item instanceof Array && item.length >= 2) {

			// Check if options has the key and is the right type
			if (_.has(options, key) && typeof options[key] === item[0]) {

				// Replace the default
				def[key] = options[key];

			// Check if the third parameter is true -> get out
			} else if (item[2] === true) throw new Error("Option `"+key+"` is not the right type.");
			else {

				// Load the default
				def[key] = item[1];

			}

		// Otherwise its an object of more keys
		} else if (typeof def[key] === "object" && typeof options[key] === "object") parse_options(options[key], def[key]);

		// Not an object? Get outta here.
		else throw new Error("Invalid default.");

	});

}

var Turbo = (function() {

	function Turbo() {
		return this;
	}

	Turbo.prototype.set_options = _.once(function(options) {
		// Parse and set options
		parse_options(options, defaults);

		// Set some basic ones
		if (defaults.ENVIRONMENT) process.env.NODE_ENV = defaults.ENVIRONMENT;
		this.PATHS = options.SYSTEM_PATHS;
	});

	Turbo.prototype.defaults = function() {
		// Clone to protect
		return _.clone(defaults);
	}

	Turbo.prototype.liftoff = function(callback) {
		// Make everything run in a Fiber
		promise.start(function() {
			// Run startup
			return require('./startup.js')(callback);
		});
	}

	return Turbo;

})();

module.exports = new Turbo();