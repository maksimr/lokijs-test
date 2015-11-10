/**
 * Create in memory database
 */
var db = new loki('myApp');


/**
 * Create tables in our database
 */
db.addCollection('photos');


describe('appSpec', function() {
    beforeEach(module('myApp'));


    beforeEach(function() {
        this.photoCollectionMock = db.getCollection('photos').insert([{}, {}]);
    });


    afterEach(function() {

        /**
         * Removed all changes made to the collection
         * during the test
         */
        db.clearChanges();
    });


    it('should be true', function() {
        expect(db.getCollection('photos').find())
            .toEqual(this.photoCollectionMock);
    });
});
