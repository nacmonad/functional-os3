app.factory('BlogService', function($resource) {
	var resourceURL = 'http://functional-aesthetics.rhcloud.com/api/blogs/:id';
	//var resourceURL = 'http://localhost:3000/api/blogs/:id';
	return $resource(resourceURL,
		{ id: '@_id'},
		{
			'update' : {method:'PUT'}
		});
});