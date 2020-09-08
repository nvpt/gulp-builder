const gulp = require('gulp');
const inject = require('gulp-inject');
const del = require('del');
const sass = require('gulp-sass');
sass.compiler = require('node-sass');
const autoprefixer = require('gulp-autoprefixer');
const concat = require('gulp-concat');
const image = require('gulp-image');
const browserSync = require('browser-sync').create();
const babel = require('gulp-babel');
const svgo = require('gulp-svgo');
const svgmin = require('gulp-svgmin');
const svgSprite = require('gulp-svg-sprite');
const cheerio = require('gulp-cheerio');
const replace = require('gulp-replace');


/**
 * Clean dist
 * @returns {Promise<string[]>}
 */
const cleanDist = async function () {
    return del.sync(['./dist/*', './dest']);//temp
};

/**
 * Render HTML files
 * @returns {Promise<void>}
 */
const renderHtml = async function () {
    // del.sync(['./dist/pages']);
    gulp.src('./src/pages/**/*.html')
        .pipe(inject(gulp.src(['./src/parts/**/*.html', './src/pages/**/*.html']), {
            starttag: '<!-- inject:{{path}} -->',
            relative: false,
            transform: function (filePath, file) {
                // return file contents as string
                return file.contents.toString('utf8');
            }
        }))
        .pipe(gulp.dest('./dist/pages/'))
        .pipe(browserSync.stream());
};

/**
 * Render global styles
 * @returns {Promise<void>}
 */
const renderStyles = async function () {
    gulp.src(['./src/styles/**/_variables.scss', './src/styles/**/*.scss', './src/pages/**/*.scss', './src/parts/**/*.scss'])
        .pipe(concat('styles.scss'))
        .pipe(sass().on('error', sass.logError))
        .pipe(autoprefixer({
            cascade: false
        }))
        .pipe(gulp.dest('./dist/styles/'));
};

/**
 * Render JS files
 * @returns {Promise<void>}
 */
const renderJs = async function () {
    gulp.src('./src/pages/**/*.js')
        .pipe(babel({
            presets: ['@babel/env']
        }))
        .pipe(gulp.dest('./dist/pages/'))
        .pipe(browserSync.stream());
};

// const injectJS = async function () {
//     gulp.src('./dist/pages/**/*.html')
//         .pipe(inject(gulp.src('./src/pages/**/*.js'), {
//             starttag: '<!-- inject:{{path}} -->',
//             relative: false,
//             transform: function (filePath, file) {
//                 // return file contents as string
//                 return file.contents.toString('utf8');
//             }
//         }))
//         .pipe(gulp.dest('./dist/pages/'))
//         .pipe(browserSync.stream());
// };
// gulp.task('inject-js', injectJS);

/**
 * Render images
 * @returns {Promise<void>}
 */
const renderImages = async function () {
    gulp.src(['./src/img/**/*', '!./src/img/svg-sprites', '!./src/img/svg-sprites/*', '!./src/img/svg-sprites/', '!./src/img/svg-sprites/**/*'])
        .pipe(image({
            quiet: true
        }))
        .pipe(svgo())
        .pipe(gulp.dest('./dist/img/'))
        .pipe(browserSync.stream());
};

/**
 * Generate sprite for unchanged svg-images
 * @returns {Promise<void>}
 */
const svgSpriteUnchanged = async function () {
    //http://glivera-team.github.io/svg/2016/06/13/svg-sprites-2.html
    gulp.src('./src/img/svg-sprites/unchanged/**/*.svg')
        // minify svg
        .pipe(svgmin({
            js2svg: {
                pretty: true
            }
        }))
        .pipe(svgSprite({
            spacing: {
                padding: 10
            },
            mode: {
                css: {
                    sprite: '../sprite-unchanged.svg',
                    prefix: '.svg-u-',
                    render: {
                        css: {
                            dest: '../styles/svg-sprite-unchanged.css',
                        }
                    }
                },
            }
        }))
        .pipe(gulp.dest('./dist/'));
};

/**
 * Generate sprite for "hovered" svg-icons
 * @returns {Promise<void>}
 */
const svgSpriteColorized = async function () {
    //http://glivera-team.github.io/svg/2016/06/13/svg-sprites-2.html
    gulp.src('./src/img/svg-sprites/colorized/**/*.svg')
        // minify svg
        .pipe(svgmin({
            js2svg: {
                pretty: true
            }
        }))
        // remove all fill, style and stroke declarations in out shapes
        .pipe(cheerio({
            run: function ($) {
                $('[fill]').removeAttr('fill');
                // $('[stroke]').removeAttr('stroke'); //no use: will delete some need elements of icons
                $('[style]').removeAttr('style');
            },
            parserOptions: {xmlMode: true}
        }))
        // cheerio plugin create unnecessary string '&gt;', so replace it.
        .pipe(replace('&gt;', '>'))
        // build svg sprite
        .pipe(svgSprite({
            spacing: {
                padding: 10
            },
            mode: {
                symbol: {
                    sprite: '../sprite.svg',
                    render: {
                        css: {
                            dest: '../styles/svg-sprite.css',
                        }
                    }
                }
            }
        }))
        .pipe(gulp.dest('./dist/'));
};

/**
 * Run all tasks
 */
const renderAll = gulp.series(
    cleanDist,
    gulp.series(
        renderHtml,
        gulp.series(
            renderJs,
            gulp.series(
                renderImages, svgSpriteUnchanged, svgSpriteColorized, renderStyles
            )
        )
    )
);


gulp.task('clean-dist', cleanDist);
gulp.task('images', renderImages);
gulp.task('render-styles', renderStyles);
gulp.task('svg-sprite-unchanged', svgSpriteUnchanged);
gulp.task('svg-sprite-colorized', svgSpriteColorized);
gulp.task('render-html-pages', renderHtml);
gulp.task('render-js', renderJs);
gulp.task('default', renderAll);


/* Watch changes */
gulp.task('watch-changes', gulp.series(renderAll, async function () {
    browserSync.init({
        server: {
            baseDir: './dist',
            directory: true
        }
    });

    gulp.watch(['./src/img/**/*', '!./src/img/svg-sprites', '!./src/img/svg-sprites/*', '!./src/img/svg-sprites/', '!./src/img/svg-sprites/**/*']).on('all', gulp.series('images', browserSync.reload));
    gulp.watch('./src/**/*.scss').on('all', gulp.series(renderStyles, browserSync.reload));
    gulp.watch('./src/img/svg-sprites/unchanged/**/*.svg').on('all', gulp.series(svgSpriteUnchanged, browserSync.reload));
    gulp.watch('./src/img/svg-sprites/colorized/**/*.svg').on('all', gulp.series(svgSpriteColorized, browserSync.reload));
    gulp.watch('./src/**/*.html', renderHtml);
    gulp.watch('./src/**/*.js', renderJs);
}));
