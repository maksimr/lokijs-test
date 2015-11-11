function isWindow(obj) {
    return obj && obj.window === obj;
}

function isScope(obj) {
    return obj && obj.$evalAsync && obj.$watch;
}

function toJsonReplacer(key, value) {
    var val = value;

    if (typeof key === 'string' && key.charAt(0) === '$' && key.charAt(1) === '$') {
        val = undefined;
    } else if (angular.isFunction(value)) {
        val = undefined;
    } else if (isWindow(value)) {
        val = '$WINDOW';
    } else if (value && document === value) {
        val = '$DOCUMENT';
    } else if (isScope(value)) {
        val = '$SCOPE';
    }

    return val;
}

function toJson(obj, pretty) {
    function isNumber(value) {
        return typeof value === 'number';
    }

    if (typeof obj === 'undefined') {
        return undefined;
    }

    if (!isNumber(pretty)) {
        pretty = pretty ? 2 : null;
    }
    return JSON.stringify(obj, toJsonReplacer, pretty);
}


/**
 * Create in memory database
 */
var db = new loki('myApp');

db.serializObject = function(model) {
    return JSON.parse(toJson(model.data || model));
};

db.serializJson = function(model) {
    return toJson(db.serializObject(model));
};

db.model = {};
db.model.User = function(user) {
    return angular.extend({}, {
        id: faker.random.uuid(),
        name: faker.name.firstName,
        avatar: faker.internet.avatar()
    }, user);
};

db.model.Photo = function(photo) {
    return angular.extend({}, {
        id: faker.random.uuid(),
        url: faker.image.imageUrl(),
        author: db.model.User(),
        comments: db.getCollection(db.COLLECTION_NAME.COMMENT)
    }, photo);
};

db.model.Comment = function(comment) {
    return angular.extend({}, {
        id: faker.random.uuid(),
        author: db.model.User(),
        text: faker.lorem.paragraph
    }, comment);
};


db.COLLECTION_NAME = {
    PHOTO: 'photo',
    USER: 'user',
    COMMENT: 'comment'
};


/**
 * Create tables in our database
 */
angular.forEach(db.COLLECTION_NAME, function(collectionName) {
    db.addCollection(collectionName);
});


/**
 * Create fake server
 */
var server = sinon.fakeServer.create();

server.flush = angular.mock.inject(['$rootScope', function($rootScope) {

    /**
     * Call respond server in angularjs context
     */
    var data;

    $rootScope.$apply();
    data = server.respond();

    return data;
}]);

var respond200 = function(xhr, model) {
    xhr.respond(200, {
        'Content-Type': 'application/json'
    }, db.serializJson(model));
};

var respond404 = function(xhr) {
    xhr.respond(404, {
        'Content-Type': 'application/json'
    }, toJson(null));
};

var respond = function(xhr, collection, id, next) {
    var model = null;

    if (!collection) {
        return respond404(xhr);
    }

    if (!id) {
        return respond200(xhr, collection);
    }

    model = collection.findOne({
        id: id
    });

    if (model && !next) {
        return respond200(xhr, model);
    } else if (model && next) {
        return next(model);
    } else {
        return respond404(xhr);
    }
};

/**
 * Handle photos request on the server
 */
server.respondWith('GET', /\/api\/photos\/?([\d-\w]+)?\/?([\w]+)?\/?([\d-\w]+)?/, function(xhr, id, subResourceName, subResourceId) {
    var photos = db.getCollection(db.COLLECTION_NAME.PHOTO);

    respond(xhr, photos, id, subResourceName ? function(photo) {
        respond(xhr, photo[subResourceName], subResourceId);
    } : null);
});


/**
 * Remove mock on $httpBackend
 */
angular.module('ngMock', ['ng']).provider({
    $browser: angular.mock.$BrowserProvider,
    $exceptionHandler: angular.mock.$ExceptionHandlerProvider,
    $log: angular.mock.$LogProvider,
    $interval: angular.mock.$IntervalProvider,
    $rootElement: angular.mock.$RootElementProvider
}).config(['$provide', function($provide) {
    $provide.decorator('$timeout', angular.mock.$TimeoutDecorator);
    $provide.decorator('$$rAF', angular.mock.$RAFDecorator);
    $provide.decorator('$rootScope', angular.mock.$RootScopeDecorator);
    $provide.decorator('$controller', angular.mock.$ControllerDecorator);
}]);


describe('appSpec', function() {
    beforeEach(module('myApp'));


    beforeEach(function() {
        this.photoCollection = db.getCollection(db.COLLECTION_NAME.PHOTO);
        this.photoCollectionMock = this.photoCollection.insert([
            db.model.Photo(),
            db.model.Photo()
        ]);
    });


    afterEach(function() {

        /**
         * Removed all changes made to the collection
         * during the test
         */
        db.clearChanges();
    });


    var $resource;
    beforeEach(inject(function(_$resource_) {
        $resource = _$resource_;
        this.photosResource = $resource('/api/photos/:id');
    }));


    it('should get collection of photos', function() {
        var photos = this.photosResource.query();

        server.flush();

        expect(angular.equals(photos, db.serializObject(this.photoCollectionMock)))
            .toEqual(true);
    });


    it('should get photo by id', function() {
        var photoMock = this.photoCollection.insert(db.model.Photo());

        var photo = this.photosResource.get({
            id: photoMock.id
        });

        server.flush();

        expect(angular.equals(photo, db.serializObject(photoMock)))
            .toEqual(true);
    });


    it('should get author of photo', function() {
        var author = null;
        var photoMock = this.photoCollection.insert(db.model.Photo());

        $resource('/api/photos/:photoId/author').get({
            photoId: photoMock.id
        }).$promise.then(function(response) {
            author = response;
        });

        server.flush();

        expect(angular.equals(author, db.serializObject(photoMock.author))).toEqual(true);
    });


    it('should get all comments attached to the photo', function() {
        var comments = null;
        var photoMock = this.photoCollection.insert(db.model.Photo());
        photoMock.comments.insert(db.model.Comment());

        $resource('/api/photos/:photoId/comments').query({
            photoId: photoMock.id
        }).$promise.then(function(response) {
            comments = response;
        });

        server.flush();

        expect(angular.equals(comments, db.serializObject(photoMock.comments))).toEqual(true);
    });


    it('should get specific comment attached to the photo', function() {
        var comment = null;
        var photoMock = this.photoCollection.insert(db.model.Photo());
        var commentMock = db.model.Comment();
        photoMock.comments.insert(commentMock);

        $resource('/api/photos/:photoId/comments/:id').get({
            photoId: photoMock.id,
            id: commentMock.id
        }).$promise.then(function(response) {
            comment = response;
        });

        server.flush();

        expect(angular.equals(comment, db.serializObject(commentMock))).toEqual(true);
    });


    it('should return 404 if photo does not exist', function() {
        var callback = jasmine.createSpy('handlePhotoError');
        this.photosResource.get({
            id: faker.random.uuid()
        }).$promise.then(null, callback);

        server.flush();

        expect(callback)
            .toHaveBeenCalled();
    });

    it('should return 404 if sub collection does not exist', function() {
        var photoMock = this.photoCollection.insert(db.model.Photo());
        var callback = jasmine.createSpy('handlePhotoError');

        $resource('/api/photos/:photoId/food').query({
            photoId: photoMock.id
        }).$promise.then(null, callback);
        server.flush();

        expect(callback)
            .toHaveBeenCalled();
    });

    it('should return 404 if entity from sub collection does not exist', function() {
        var photoMock = this.photoCollection.insert(db.model.Photo());
        photoMock.comments.insert(db.model.Comment());
        var callback = jasmine.createSpy('handlePhotoError');

        $resource('/api/photos/:photoId/comments/:id').query({
            photoId: photoMock.id,
            id: faker.random.uuid()
        }).$promise.then(null, callback);
        server.flush();

        expect(callback)
            .toHaveBeenCalled();
    });
});
