/**
 * API:
 *
 * ifNeeded([ignoreNativeAPNG bool]) → Promise()
 * animateImage(img HTMLImageElement) → Promise()
 *
 * animateContext(url String, CanvasRenderingContext2D context) → Promise(Animation)
 * parseBuffer(ArrayBuffer) → Promise(Animation)
 * parseURL(url String) → Promise(Animation)
 * checkNativeFeatures() → Promise(features)
 */
"use strict";

window.URL = window.URL || window.webkitURL;

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
// MIT license
(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 50); // fix 20fps
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());

var support = require("./support-test");
var parseAPNG = require("./parser");
var loadUrl = require('./loader');

var APNG = global.APNG = {};

APNG.checkNativeFeatures = support.checkNativeFeatures;
APNG.ifNeeded = support.ifNeeded;

/**
 * @param {ArrayBuffer} buffer
 * @return {Promise}
 */
APNG.parseBuffer = function (buffer) { return parseAPNG(buffer); };

var url2promise = {};
/**
 * @param {String} url
 * @return {Promise}
 */
APNG.parseURL = function (url) {
    if (!(url in url2promise)) url2promise[url] = loadUrl(url).then(parseAPNG);
    return url2promise[url];
};

/**
 * @param {String} url
 * @param {CanvasRenderingContext2D} context
 * @return {Promise}
 */
APNG.animateContext = function (url, context) {
    return APNG.parseURL(url).then(function (a) {
        a.addContext(context);
        a.play();
        return a;
    });
};

/**
 * @param {HTMLImageElement} img
 * @return {Promise}
 */
APNG.animateImage = function (img) {
    img.setAttribute("data-is-apng", "progress");
    return APNG.parseURL(img.src).then(
        function (anim) {
            img.setAttribute("data-is-apng", "yes");
            var canvas = document.createElement("canvas");
            canvas.width = anim.width;
            canvas.height = anim.height;
            Array.prototype.slice.call(img.attributes).forEach(function (attr) {
                if (["alt", "src", "usemap", "ismap", "data-is-apng", "width", "height"].indexOf(attr.nodeName) == -1) {
                    canvas.setAttributeNode(attr.cloneNode(false));
                }
            });
            canvas.setAttribute("data-apng-src", img.src);
            if (img.alt != "") canvas.appendChild(document.createTextNode(img.alt));

            var imgWidth = "", imgHeight = "", val = 0, unit = "";

            if (img.style.width != "" && img.style.width != "auto") {
                imgWidth = img.style.width;
            } else if (img.hasAttribute("width")) {
                imgWidth = img.getAttribute("width") + "px";
            }
            if (img.style.height != "" && img.style.height != "auto") {
                imgHeight = img.style.height;
            } else if (img.hasAttribute("height")) {
                imgHeight = img.getAttribute("height") + "px";
            }
            if (imgWidth != "" && imgHeight == "") {
                val = parseFloat(imgWidth);
                unit = imgWidth.match(/\D+$/)[0];
                imgHeight = Math.round(canvas.height * val / canvas.width) + unit;
            }
            if (imgHeight != "" && imgWidth == "") {
                val = parseFloat(imgHeight);
                unit = imgHeight.match(/\D+$/)[0];
                imgWidth = Math.round(canvas.width * val / canvas.height) + unit;
            }
            canvas.style.width = imgWidth;
            canvas.style.height = imgHeight;

            var p = img.parentNode;
            p.insertBefore(canvas, img);
            p.removeChild(img);
            anim.addContext(canvas.getContext("2d"));
            anim.play();
        },
        function () {
            img.setAttribute("data-is-apng", "no");
        });
};

/**
 * @param {HTMLCanvasElement} canvas
 * @return {void}
 */
APNG.releaseCanvas = function(canvas) {
    var ctx = canvas.getContext("2d");
    if ('_apng_animation' in ctx) {
        ctx['_apng_animation'].removeContext(ctx);
    }
};

module.exports = APNG;