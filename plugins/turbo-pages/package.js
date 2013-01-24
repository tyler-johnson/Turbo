// Load some major dependencies
var Handlebars = require('handlebars'),
	_ = require('underscore'),
	Turbo = require('../../lib/turbo');
	
// Layout "cache"
var layouts = {};

// Register a new "page" forward
Turbo.router.register_forward("page", function(req, res) {
	var data = req.route.data,
		route = req.route,
		layout, template_name;

	// Look for a template
	template_name = data.template || null;
	
	// Create a new layout or pull one form the cache
	if (_.has(layouts, template_name)) layout = layouts[template_name];
	else layout = layouts[template_name] = Turbo.theme.new_layout_by_type("page", template_name);

	if (!layout) req.route.throw_error("Could not find a page template in your theme.", 404);
	
	// Make handlebars like our content
	data.content = new Handlebars.SafeString(data.content);
	
	// Precompile, cache, compile, cache, cache, return, cache
	var compiled = layout.compile(data);
	Turbo.router.cache_route(req.route.pathname, compiled, 60 * 3);
	
	res.type("html");
	res.send(compiled);
});