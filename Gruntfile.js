module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-screeps');

    grunt.initConfig({
        screeps: {
            options: {
                email: '2673397594@qq.com',
                token: 'd231e466-8559-465b-b98b-3319c22df738',
                branch: 'default',
                //server: 'season'
            },
            dist: {
                src: ['src/**/*.js']
            }
        }
    });
}