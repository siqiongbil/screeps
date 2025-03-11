module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');

    grunt.initConfig({
        screeps: {
            options: {
                email: '<your email>',
                token: 'your token',
                branch: 'your branch',
                //server: 'season'
            },
            dist: {
                src: ['src/**/*.js']
            }
        }
    });
}