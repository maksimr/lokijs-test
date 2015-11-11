/**
 * Create in memory database
 */
var db = new loki('myApp');


/**
 * Create tables in our database
 */
db.addCollection('photos');


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
        this.photoCollectionMock = db.getCollection('photos').insert([{}, {}]);

        server.respondWith('GET', '/api/photos', JSON.stringify(this.photoCollectionMock));
        server.respondWith('GET', /\/api\/photos\/(\d+)/, function(xhr, id) {
            var photo = db.getCollection('photos').findOne({
                id: id
            });

            if (photo) {
                xhr.respond(200, {
                    'Content-Type': 'application/json'
                }, JSON.stringify(photo));
            } else {
                xhr.respond(404, {
                    'Content-Type': 'application/json'
                }, JSON.stringify({}));
            }
        });
    });


    afterEach(function() {

        /**
         * Removed all changes made to the collection
         * during the test
         */
        db.clearChanges();
    });


    beforeEach(inject(function($resource) {
        this.photosResource = $resource('/api/photos/:id');
    }));


    it('should get collection of photos', function() {
        var photos = this.photosResource.query();

        server.flush();

        expect(angular.equals(photos, this.photoCollectionMock))
            .toEqual(true);
    });


    it('should get photo by id', function() {
        var photoId = '1';
        var photoMock = db.getCollection('photos').insert({
            id: photoId
        });

        var photo = this.photosResource.get({
            id: photoId
        });

        server.flush();

        expect(angular.equals(photo, photoMock))
            .toEqual(true);
    });


    it('should return 404 if photo does not exist', function() {
        var callback = jasmine.createSpy('handlePhotoError');
        this.photosResource.get({
            id: '1001'
        }).$promise.then(null, callback);

        server.flush();

        expect(callback)
            .toHaveBeenCalled();
    });
});
