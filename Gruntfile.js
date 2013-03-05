module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src:  'build/greader.js',
        dest: 'build/greader.min.js'
      }
    },
    concat: {
      options: {
        banner: "(function() {\n",
        footer: "\n}).call(this);"
      },
      dist: {
        src: [
          'src/globals.js',
          'src/env.js',
          'src/memory-store.js',
          'src/persistance.js',
          'src/networking.js',
          'src/user.js',
          'src/feeds.js',
          'src/items.js',
          'src/tools.js'
        ],
        dest: 'build/greader.js' 
      }
    },
    watch: {
      files: ['<%= concat.dist.src %>'],
      tasks: ['concat']
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task(s).
  grunt.registerTask('default', ['concat', 'uglify', 'watch']);


};