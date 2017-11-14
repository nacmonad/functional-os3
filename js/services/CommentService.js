app.factory('CommentService', function($resource) {
	var resourceURL = 'http://functional-aesthetics.rhcloud.com/api/comments/:id';
	//var resourceURL = 'http://localhost:3000/api/comments/:id';
	return $resource(resourceURL,
		{ id: '@_id'},
		{
			'get':    {method:'GET',isArray:true},
			'update' : {method:'PUT'}
		});
});