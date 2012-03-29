/*jslint browser: true, vars: true, maxerr: 500, indent: 4 */
/*global $, _, Processing */
$(document).ready(function () {
    "use strict";
    
    var clamp = function (min, max, val) {
        return Math.max(min, Math.min(max, val));
    };
    var lerp = function (min, max, val, valmin, valmax) {
        var coef = val;
        if (valmin !== undefined && valmax !== undefined) {
            coef = (val - valmin) / (valmax - valmin);
        }

        return ((1 - coef) * min) + coef * max;
    };


    var chart = function (element) {

        var canvasWidth = element.width(),
            canvasHeight = element.height();

        var generateData = function () {
            var series = [],
                y = Math.random() * 5 + 2,
                minY = Infinity,
                maxY = -Infinity,
                minX = Infinity,
                maxX = -Infinity;

            for (var x = 0; x < 40; x++) {
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);

                series[x] = y;
                y += Math.random() - 0.5;
            }

            return {
                data: series,
                minY: minY,
                maxY: maxY,
                minX: minX,
                maxX: maxX
            }
        };

        var data = {
            bounds: {
                minY: 0,
                maxY: 10,
                minX: 0,
                maxX: 40
            },
            series: [
                generateData(),
                generateData(),
                generateData(),
                generateData(),
                generateData()
            ]
        };


        var sketchProc = function (p) {
            // init
            p.size(canvasWidth, canvasHeight);
            p.frameRate(0);

            var fontA = p.loadFont("Helvetica Neue Bold");
            p.textFont(fontA, 14);
            p.textAlign(p.LEFT);

			var fontForSize = [];
			for (var i=0; i<50; i++) {
				fontForSize[i] = p.createFont("FFScala", i);
			}

            var getMouseEngagement = function (options) {
                options.borderWidth = typeof options.borderWidth !== 'undefined' ? options.borderWidth : 80;
                options.justHorizontal = typeof options.justHorizontal !== 'undefined' ? options.justHorizontal : false;

                var xEngagement = Math.min(p.mouseX, canvasWidth - p.mouseX) / options.borderWidth;
                var yEngagement = Math.min(p.mouseY, canvasHeight - p.mouseY) / options.borderWidth;

                var engagement = options.justHorizontal ? xEngagement : Math.min(xEngagement, yEngagement);
                var engagement = clamp(0, 1, engagement);
                return engagement;
            };

            var multiplyAlpha = function (c, o) {
                return p.color(p.red(c), p.green(c), p.blue(c), p.alpha(c) * o);
            }

            var drawChart = function (data, engagement, hEngagement) {
                var colors = {
                    red: p.color(203, 67, 63),     // p.color(255, 0, 0),
                    yellow: p.color(255, 255, 0),
                    violet: p.color(133, 83, 142),
                    orange: p.color(238, 177, 76),  // p.color(255, 128, 0),
                    green: p.color(110, 165, 90),   // p.color(0, 192, 0),
                    blue: p.color(59, 108, 159)     // p.color(0, 0, 192)
                };
                var m = { // metrics
                    inactiveLineWidth: 2,
                    activeLineWidth: 3,
                    hoverLineWidth: 6
                };
                var engageColor = function(c) {
                    // return c;
                    // return p.lerpColor(p.color(p.brightness(c)), c, 0.5 + 0.5 * engagement);
                    return p.lerpColor(p.color(p.brightness(c)), c, 0.9 + 0.1 * engagement);
                };
                var c = { // constants
                    axisColor: p.color(255 - 32 * engagement),
                    negativeBackgroundColor: p.color(255 - 4 * engagement),
                    backgroundColor: p.color(255), // 255 - 8 * engagement
                    lineColors: [
                        engageColor(colors.red),
                        engageColor(colors.orange),
                        engageColor(colors.violet),
                        engageColor(colors.green),
                        engageColor(colors.blue)
                    ]
                };
                // erase background
                p.background(c.backgroundColor);

                var margin = 20;
                // translate x from data coords to screen coords
                var sx = function (x) {
                    return margin + x * (canvasWidth - 2 * margin) / (data.bounds.maxX - 0 /*data.bounds.minX*/);
                };
                var sy = function (y) {
                    return canvasHeight - margin - y * (canvasHeight - 2 * margin) / (data.bounds.maxY - 0 /*data.bounds.minY*/);
                };
                // inverse transforms - screen coords to data coords
                var dx = function (x) {
                    return (x - margin) * ( data.bounds.maxX - 0 ) / (canvasWidth - 2 * margin);
                };
                var dy = function (y) {
                    return (y - margin + canvasHeight) * ( data.bounds.maxY - 0 ) / (canvasHeight - 2 * margin);
                };

                p.ellipseMode(p.CENTER);

                p.pushMatrix();

                // track closest line
                // trackers:
                var dataX = Math.round(dx(p.mouseX));
                var dataY = dy(p.mouseY);
                var closestSeries = -1,
                    closestDistance = Infinity;
                _.each(data.series, function (serie, idx) {
                    if (!serie.data[dataX]) {
                        return;
                    }

                    var x = sx(dataX);
                    var y = sy(serie.data[dataX]);

                    if (Math.abs(p.mouseY - y) < closestDistance) {
                        closestSeries = idx;
                        closestDistance = Math.abs(p.mouseY - y);
                    }
                });

                // tracker distances
                var distCache = [];
                _.each(data.series, function (serie, idx) {
                    var engageThickness = lerp(m.inactiveLineWidth, m.activeLineWidth, engagement);
                    if (!serie.data[dataX]) {
                        distCache.push({
                            idx: idx,
                            thickness: engageThickness,
                            valid: false
                        });
                        return;
                    }
                    var y = sy(serie.data[dataX]);
                    distCache.push({
                        idx: idx,
                        dist: Math.abs(p.mouseY - y),
                        y: y,
                        thickness: engageThickness,
                        valid: true
                    });
                });
                // choose top 2, interpolate
                distCache.sort(function(a, b) { return a.dist - b.dist; });
                if (distCache[0] && distCache[0].valid)
                    distCache[0].thickness =
                        lerp(distCache[0].thickness, lerp(m.hoverLineWidth, m.activeLineWidth, distCache[0].dist, 0, distCache[0].dist + distCache[1].dist), engagement);
                if (distCache[1] && distCache[1].valid)
                    distCache[1].thickness =
                        lerp(distCache[1].thickness, lerp(m.hoverLineWidth, m.activeLineWidth, distCache[1].dist, 0, distCache[0].dist + distCache[1].dist), engagement);
                var thicknesses = [];
                _.map(distCache, function(entry) {
                    thicknesses[entry.idx] = entry.thickness;
                });


                // negative bg - fake, between 0 and 3
                for (var y = sy(3); y < sy(0); y++) {
                    p.stroke(multiplyAlpha(c.negativeBackgroundColor, lerp(0, 1, y, sy(0), sy(3))));
                    p.line(sx(-1), y, sx(40), y);
                }
                // draw lines
                p.stroke(c.axisColor);
                p.strokeWeight(1);
                p.noFill();
                p.line(sx(0), sy(-1), sx(0), sy(10));
                //p.line(sx(-1), sy(0), sx(40), sy(0));
                // x axis
                p.stroke(c.axisColor);
                p.line(sx(-1), sy(3), sx(40), sy(3));

                _.each(data.series, function (serie, idx) {
                    p.strokeWeight(thicknesses[idx]
                        /*idx == closestSeries
                            ? lerp(3, 6, engagement)
                            : 3*/);
                    p.stroke(c.lineColors[idx]);
                    p.beginShape();
                    p.vertex(sx(0), sy(serie.data[0]));
                    _.each(serie.data, function (y, x) {
                        // console.log('[' + x + ', ' + y + '] -> [' + sx(x) + ', ' + sy(y) + ']');
                        p.vertex(sx(x), sy(y));
                    });
                    p.endShape();
                });

                if (engagement > 0) {
                    // trackers:
                    _.each(data.series, function (serie, idx) {
                        if (!serie.data[dataX]) {
                            return;
                        }

                        var x = sx(dataX);
                        var y = sy(serie.data[dataX]);

                        // tooltip rect
                        p.fill(multiplyAlpha(p.color(255, 255, 255, 240), engagement));
                        p.noStroke();
                        p.rect(x+10, y+6 - 5 * thicknesses[idx], 14 * thicknesses[idx], 5 * thicknesses[idx]);

                        // tooltip lines
                        p.stroke(multiplyAlpha(c.lineColors[idx],engagement));
                        p.strokeWeight(1);
                        p.noFill();
                        p.line(x, y, x+8, y+6);
                        p.line(x+8, y+6, x+8 + 14 * thicknesses[idx], y+6);

                        // ellipses
                        p.noStroke();
                        p.fill(multiplyAlpha(c.lineColors[idx],engagement));
                        // var size = ( Math.abs(dataY - serie.data[dataX]) );
                        var outerRadius = lerp(0, 10, hEngagement);
                        var innerRadius = lerp(0, 4, hEngagement);
                        p.ellipse(x, y, outerRadius, outerRadius);
                        p.fill(multiplyAlpha(p.color(255),engagement));
                        p.ellipse(x, y, innerRadius, innerRadius);

						//p.textSize(5 * thicknesses[idx]);
						p.textFont(fontForSize[Math.round(5 * thicknesses[idx])]);

                        // tooltip text
                        p.fill(multiplyAlpha(p.color(0, 0, 0, 255), engagement + 0.01 /* font hack */));
                        p.text(y.toFixed(1), x+12, y+4);

                    });
					p.textFont(fontForSize[14]);

                    // axe description:
                    p.fill(multiplyAlpha(p.color(128, 128, 128, 255), engagement + 0.01 /* font hack */));
                    p.text('Months', canvasWidth / 2 - 40, canvasHeight - 20);
                    p.pushMatrix();
                    // p.rotate(p.HALF_PI);
                    p.rotate(- p.PI / 2);
                    p.text('Revenue (USD)', -150, 32);
                    p.popMatrix();
                }


                p.popMatrix();
            };

            p.mouseMoved = function () {
                var engagement = getMouseEngagement({});
                var hEngagement = getMouseEngagement({ justHorizontal: true });

                drawChart(data, engagement, hEngagement);
            };

            // Override draw function, by default it will be called 60 times per second
            p.draw = function () {
            };

            element.mouseleave(function () {
                drawChart(data, 0, 0);
            });
            
            // initial
            drawChart(data, 0, 0);
        };

        return new Processing(element.get(0), sketchProc);
    };

    chart($('#chart1'));
    chart($('#chart2'));


    var clock = function (element) {

        var canvasWidth = element.width(),
            canvasHeight = element.height();


        var sketchProc = function (p) {
            // init
            p.size(canvasWidth, canvasHeight);

            // Override draw function, by default it will be called 60 times per second
            p.draw = function () {
                // determine center and max clock arm length
                var centerX = p.width / 2, centerY = p.height / 2;
                var maxArmLength = Math.min(centerX, centerY);

                function drawArm(position, lengthScale, weight) {
                    p.strokeWeight(weight);
                    p.line(centerX, centerY,
                        centerX + Math.sin(position * 2 * Math.PI) * lengthScale * maxArmLength,
                        centerY - Math.cos(position * 2 * Math.PI) * lengthScale * maxArmLength);
                }

                // erase background
                p.background(255);

                var now = new Date();

                // Moving hours arm by small increments
                var hoursPosition = (now.getHours() % 12 + now.getMinutes() / 60) / 12;
                drawArm(hoursPosition, 0.5, 5);

                // Moving minutes arm by small increments
                var minutesPosition = (now.getMinutes() + now.getSeconds() / 60) / 60;
                drawArm(minutesPosition, 0.80, 3);

                // Moving hour arm by second increments
                var secondsPosition = now.getSeconds() / 60;
                drawArm(secondsPosition, 0.90, 1);
            };
        };

        return new Processing(element.get(0), sketchProc);
    };
    // clock($('#clock'));

});

