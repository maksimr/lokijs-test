// Karma configuration
// Generated on Wed Nov 11 2015 00:56:14 GMT+0300 (MSK)

module.exports = function(config) {
    config.set({
        frameworks: ['phantomjs-shim', 'jasmine', 'sinon'],
        files: [
            './node_modules/angular/angular.js',
            './node_modules/angular-resource/angular-resource.js',
            './node_modules/angular-mocks/angular-mocks.js',
            './node_modules/lokijs/src/lokijs.js',

            'lib/*.js',
            'test/**/*Spec.js'
        ],
        reporters: ['progress'],
        autoWatch: true,
        browsers: ['PhantomJS'],
        singleRun: false
    });
};
