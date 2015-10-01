(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
      // AMD. Register as an anonymous module.
      define([], factory);
  } else if (typeof module === 'object' && module.exports) {
      // Node. Does not work with strict CommonJS, but
      // only CommonJS-like environments that support module.exports,
      // like Node.
      module.exports = factory();
  } else {
      // Browser globals (root is window)
      root.RainyDay = factory();
  }
}(this, function () {
	/**
	 * Defines a new instance of the rainyday.js.
	 * @param options options element with script parameters
	 * @param canvas to be used (if not defined a new one will be created)
	 */
	function RainyDay(options, canvas) {

		if (this === window) { //if *this* is the window object, start over with a *new* object
			return new RainyDay(options, canvas);
		}

		this.img = options.image;
		var defaults = {
			opacity: 1,
			crop: [0, 0, this.img.naturalWidth, this.img.naturalHeight],
			enableSizeChange: true,
			parentElement: document.getElementsByTagName('body')[0],
			fps: 30,
			fillStyle: '#8ED6FF',
			enableCollisions: true,
			gravityThreshold: 3,
			gravityAngle: Math.PI / 2,
			gravityAngleVariance: 0,
			reflectionScaledownFactor: 5,
			reflectionDropMappingWidth: 200,
			reflectionDropMappingHeight: 200,
			width: this.img.clientWidth,
			height: this.img.clientHeight,
			position: 'absolute',
			top: 0,
			left: 0
		};

		// add the defaults to options
		for (var option in defaults) {
			if (typeof options[option] === 'undefined') {
				options[option] = defaults[option];
			}
		}
		this.options = options;

		this.drops = [];

		// prepare canvas elements
		this.canvas = canvas || this.prepareCanvas();
		this.prepareBackground();
		this.prepareGlass();

		// assume defaults
		this.reflection = this.REFLECTION_MINIATURE;
		this.trail = this.TRAIL_DROPS;
		this.gravity = this.GRAVITY_NON_LINEAR;
		this.collision = this.COLLISION_SIMPLE;

		// set polyfill of requestAnimationFrame
		this.setRequestAnimFrame();
	}

	/**
	 * Create the main canvas over a given element
	 * @returns HTMLElement the canvas
	 */
	RainyDay.prototype.prepareCanvas = function() {
		var canvas = document.createElement('canvas');
		canvas.style.position = this.options.position;
		canvas.style.top = this.options.top;
		canvas.style.left = this.options.left;
		canvas.width = this.options.width;
		canvas.height = this.options.height;
		this.options.parentElement.appendChild(canvas);
		if (this.options.enableSizeChange) {
			this.setResizeHandler();
		}
		return canvas;
	};

	RainyDay.prototype.setResizeHandler = function() {
		// use setInterval if oneresize event already use by other.
		if (window.onresize !== null) {
			window.setInterval(this.checkSize.bind(this), 100);
		} else {
			window.onresize = this.checkSize.bind(this);
			window.onorientationchange = this.checkSize.bind(this);
		}
	};

	/**
	 * Periodically check the size of the underlying element
	 */
	RainyDay.prototype.checkSize = function() {
		var clientWidth = this.img.clientWidth;
		var clientHeight = this.img.clientHeight;
		var clientOffsetLeft = this.img.offsetLeft;
		var clientOffsetTop = this.img.offsetTop;
		var canvasWidth = this.canvas.width;
		var canvasHeight = this.canvas.height;
		var canvasOffsetLeft = this.canvas.offsetLeft;
		var canvasOffsetTop = this.canvas.offsetTop;

		if (canvasWidth !== clientWidth || canvasHeight !== clientHeight) {
			this.canvas.width = clientWidth;
			this.canvas.height = clientHeight;
			this.prepareBackground();
			this.glass.width = this.canvas.width;
			this.glass.height = this.canvas.height;
			this.prepareReflections();
		}
		if (canvasOffsetLeft !== clientOffsetLeft || canvasOffsetTop !== clientOffsetTop) {
			this.canvas.offsetLeft = clientOffsetLeft;
			this.canvas.offsetTop = clientOffsetTop;
		}
	};

	/**
	 * Start animation loop
	 */
	RainyDay.prototype.animateDrops = function() {
		if (this.addDropCallback) {
			this.addDropCallback();
		}
		// |this.drops| array may be changed as we iterate over drops
		var dropsClone = this.drops.slice();
		var newDrops = [];
		for (var i = 0; i < dropsClone.length; ++i) {
			if (dropsClone[i].animate()) {
				newDrops.push(dropsClone[i]);
			}
		}
		this.drops = newDrops;
		window.requestAnimFrame(this.animateDrops.bind(this));
	};

	/**
	 * Polyfill for requestAnimationFrame
	 */
	RainyDay.prototype.setRequestAnimFrame = function() {
		var fps = this.options.fps;
		window.requestAnimFrame = (function() {
			return window.requestAnimationFrame ||
				window.webkitRequestAnimationFrame ||
				window.mozRequestAnimationFrame ||
				function(callback) {
					window.setTimeout(callback, 1000 / fps);
				};
		})();
	};

	/**
	 * Create the helper canvas for rendering raindrop reflections.
	 */
	RainyDay.prototype.prepareReflections = function() {
		this.reflected = this.reflected || document.createElement('canvas');
		this.reflected.width = this.canvas.width / this.options.reflectionScaledownFactor;
		this.reflected.height = this.canvas.height / this.options.reflectionScaledownFactor;
		var ctx = this.reflected.getContext('2d');
		ctx.drawImage(this.img, this.options.crop[0], this.options.crop[1], this.options.crop[2], this.options.crop[3], 0, 0, this.reflected.width, this.reflected.height);
	};

	/**
	 * Create the glass canvas.
	 */
	RainyDay.prototype.prepareGlass = function() {
		this.glass = this.glass || document.createElement('canvas');
		this.glass.width = this.canvas.width;
		this.glass.height = this.canvas.height;
		this.context = this.glass.getContext('2d');
	};

	/**
	 * Main function for starting rain rendering.
	 * @param presets list of presets to be applied
	 * @param speed speed of the animation (if not provided or 0 static image will be generated)
	 */
	RainyDay.prototype.rain = function(presets, speed) {
		// prepare canvas for drop reflections
		if (this.reflection !== this.REFLECTION_NONE) {
			this.prepareReflections();
		}

		this.animateDrops();

		// animation
		this.presets = presets;

		this.PRIVATE_GRAVITY_FORCE_FACTOR_Y = (this.options.fps * 0.001) / 25;
		this.PRIVATE_GRAVITY_FORCE_FACTOR_X = ((Math.PI / 2) - this.options.gravityAngle) * (this.options.fps * 0.001) / 50;

		// prepare gravity matrix
		if (this.options.enableCollisions) {

			// calculate max radius of a drop to establish gravity matrix resolution
			var maxDropRadius = 0;
			for (var i = 0; i < presets.length; i++) {
				if (presets[i][0] + presets[i][1] > maxDropRadius) {
					maxDropRadius = Math.floor(presets[i][0] + presets[i][1]);
				}
			}

			if (maxDropRadius > 0) {
				// initialize the gravity matrix
				var mwi = Math.ceil(this.canvas.width / maxDropRadius);
				var mhi = Math.ceil(this.canvas.height / maxDropRadius);
				this.matrix = new CollisionMatrix(mwi, mhi, maxDropRadius);
			} else {
				this.options.enableCollisions = false;
			}
		}

		for (var i = 0; i < presets.length; i++) {
			if (!presets[i][3]) {
				presets[i][3] = -1;
			}
		}

		var lastExecutionTime = 0;
		this.addDropCallback = function() {
			var timestamp = new Date().getTime();
			if (timestamp - lastExecutionTime < speed) {
				return;
			}
			lastExecutionTime = timestamp;
			var context = this.canvas.getContext('2d');
			context.clearRect(0, 0, this.canvas.width, this.canvas.height);
			context.drawImage(this.background, 0, 0, this.canvas.width, this.canvas.height);
			// select matching preset
			var preset;
			for (var i = 0; i < presets.length; i++) {
				if (presets[i][2] > 1 || presets[i][3] === -1) {
					if (presets[i][3] !== 0) {
						presets[i][3]--;
						for (var y = 0; y < presets[i][2]; ++y) {
							this.putDrop(new Drop(this, Math.random() * this.canvas.width, Math.random() * this.canvas.height, presets[i][0], presets[i][1]));
						}
					}
				} else if (Math.random() < presets[i][2]) {
					preset = presets[i];
					break;
				}
			}
			if (preset) {
				this.putDrop(new Drop(this, Math.random() * this.canvas.width, Math.random() * this.canvas.height, preset[0], preset[1]));
			}
			context.save();
			context.globalAlpha = this.options.opacity;
			context.drawImage(this.glass, 0, 0, this.canvas.width, this.canvas.height);
			context.restore();
		}
			.bind(this);
	};

	/**
	 * Adds a new raindrop to the animation.
	 * @param drop drop object to be added to the animation
	 */
	RainyDay.prototype.putDrop = function(drop) {
		drop.draw();
		if (this.gravity && drop.r > this.options.gravityThreshold) {
			if (this.options.enableCollisions) {
				this.matrix.update(drop);
			}
			this.drops.push(drop);
		}
	};

	/**
	 * Clear the drop and remove from the list if applicable.
	 * @drop to be cleared
	 * @force force removal from the list
	 * result if true animation of this drop should be stopped
	 */
	RainyDay.prototype.clearDrop = function(drop, force) {
		var result = drop.clear(force);
		if (result) {
			var index = this.drops.indexOf(drop);
			if (index >= 0) {
				this.drops.splice(index, 1);
			}
		}
		return result;
	};

	/**
	 * Defines a new raindrop object.
	 * @param rainyday reference to the parent object
	 * @param centerX x position of the center of this drop
	 * @param centerY y position of the center of this drop
	 * @param min minimum size of a drop
	 * @param base base value for randomizing drop size
	 */

	function Drop(rainyday, centerX, centerY, min, base) {
		this.x = Math.floor(centerX);
		this.y = Math.floor(centerY);
		this.r = (Math.random() * base) + min;
		this.rainyday = rainyday;
		this.context = rainyday.context;
		this.reflection = rainyday.reflected;
	}

	/**
	 * Draws a raindrop on canvas at the current position.
	 */
	Drop.prototype.draw = function() {
		this.context.save();
		this.context.beginPath();

		var orgR = this.r;
		this.r = 0.95 * this.r;
		if (this.r < 3) {
			this.context.arc(this.x, this.y, this.r, 0, Math.PI * 2, true);
			this.context.closePath();
		} else if (this.colliding || this.yspeed > 2) {
			if (this.colliding) {
				var collider = this.colliding;
				this.r = 1.001 * (this.r > collider.r ? this.r : collider.r);
				this.x += (collider.x - this.x);
				this.colliding = null;
			}

			var yr = 1 + 0.1 * this.yspeed;
			this.context.moveTo(this.x - this.r / yr, this.y);
			this.context.bezierCurveTo(this.x - this.r, this.y - this.r * 2, this.x + this.r, this.y - this.r * 2, this.x + this.r / yr, this.y);
			this.context.bezierCurveTo(this.x + this.r, this.y + yr * this.r, this.x - this.r, this.y + yr * this.r, this.x - this.r / yr, this.y);
		} else {
			this.context.arc(this.x, this.y, this.r * 0.9, 0, Math.PI * 2, true);
			this.context.closePath();
		}

		this.context.clip();

		this.r = orgR;

		if (this.rainyday.reflection) {
			this.rainyday.reflection(this);
		}

		this.context.restore();
	};

	/**
	 * Clears the raindrop region.
	 * @param force force stop
	 * @returns Boolean true if the animation is stopped
	 */
	Drop.prototype.clear = function(force) {
		this.context.clearRect(this.x - this.r - 1, this.y - this.r - 2, 2 * this.r + 2, 2 * this.r + 2);
		if (force) {
			this.terminate = true;
			return true;
		}
		if ((this.y - this.r > this.rainyday.canvas.height) || (this.x - this.r > this.rainyday.canvas.width) || (this.x + this.r < 0)) {
			// over edge so stop this drop
			return true;
		}
		return false;
	};

	/**
	 * Moves the raindrop to a new position according to the gravity.
	 */
	Drop.prototype.animate = function() {
		if (this.terminate) {
			return false;
		}
		var stopped = this.rainyday.gravity(this);
		if (!stopped && this.rainyday.trail) {
			this.rainyday.trail(this);
		}
		if (this.rainyday.options.enableCollisions) {
			var collisions = this.rainyday.matrix.update(this, stopped);
			if (collisions) {
				this.rainyday.collision(this, collisions);
			}
		}
		return !stopped || this.terminate;
	};

	/**
	 * TRAIL function: no trail at all
	 */
	RainyDay.prototype.TRAIL_NONE = function() {
		// nothing going on here
	};

	/**
	 * TRAIL function: trail of small drops (default)
	 * @param drop raindrop object
	 */
	RainyDay.prototype.TRAIL_DROPS = function(drop) {
		if (!drop.trailY || drop.y - drop.trailY >= Math.random() * 100 * drop.r) {
			drop.trailY = drop.y;
			this.putDrop(new Drop(this, drop.x + (Math.random() * 2 - 1) * Math.random(), drop.y - drop.r - 5, Math.ceil(drop.r / 5), 0));
		}
	};

	/**
	 * TRAIL function: trail of unblurred image
	 * @param drop raindrop object
	 */
	RainyDay.prototype.TRAIL_SMUDGE = function(drop) {
		var y = drop.y - drop.r - 3;
		var x = drop.x - drop.r / 2 + (Math.random() * 2);
		if (y < 0 || x < 0) {
			return;
		}
		this.context.drawImage(this.clearbackground, x, y, drop.r, 2, x, y, drop.r, 2);
	};

	/**
	 * GRAVITY function: no gravity at all
	 * @returns Boolean true if the animation is stopped
	 */
	RainyDay.prototype.GRAVITY_NONE = function() {
		return true;
	};

	/**
	 * GRAVITY function: linear gravity
	 * @param drop raindrop object
	 * @returns Boolean true if the animation is stopped
	 */
	RainyDay.prototype.GRAVITY_LINEAR = function(drop) {
		if (this.clearDrop(drop)) {
			return true;
		}

		if (drop.yspeed) {
			drop.yspeed += this.PRIVATE_GRAVITY_FORCE_FACTOR_Y * Math.floor(drop.r);
			drop.xspeed += this.PRIVATE_GRAVITY_FORCE_FACTOR_X * Math.floor(drop.r);
		} else {
			drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y;
			drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X;
		}

		drop.y += drop.yspeed;
		drop.draw();
		return false;
	};

	/**
	 * GRAVITY function: non-linear gravity (default)
	 * @param drop raindrop object
	 * @returns Boolean true if the animation is stopped
	 */
	RainyDay.prototype.GRAVITY_NON_LINEAR = function(drop) {
		if (this.clearDrop(drop)) {
			return true;
		}

		if (drop.collided) {
			drop.collided = false;
			drop.seed = Math.floor(drop.r * Math.random() * this.options.fps);
			drop.skipping = false;
			drop.slowing = false;
		} else if (!drop.seed || drop.seed < 0) {
			drop.seed = Math.floor(drop.r * Math.random() * this.options.fps);
			drop.skipping = drop.skipping === false ? true : false;
			drop.slowing = true;
		}

		drop.seed--;

		if (drop.yspeed) {
			if (drop.slowing) {
				drop.yspeed /= 1.1;
				drop.xspeed /= 1.1;
				if (drop.yspeed < this.PRIVATE_GRAVITY_FORCE_FACTOR_Y) {
					drop.slowing = false;
				}

			} else if (drop.skipping) {
				drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y;
				drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X;
			} else {
				drop.yspeed += 1 * this.PRIVATE_GRAVITY_FORCE_FACTOR_Y * Math.floor(drop.r);
				drop.xspeed += 1 * this.PRIVATE_GRAVITY_FORCE_FACTOR_X * Math.floor(drop.r);
			}
		} else {
			drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y;
			drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X;
		}

		if (this.options.gravityAngleVariance !== 0) {
			drop.xspeed += ((Math.random() * 2 - 1) * drop.yspeed * this.options.gravityAngleVariance);
		}

		drop.y += drop.yspeed;
		drop.x += drop.xspeed;

		drop.draw();
		return false;
	};

	/**
	 * Utility function to return positive min value
	 * @param val1 first number
	 * @param val2 second number
	 */
	RainyDay.prototype.positiveMin = function(val1, val2) {
		var result = 0;
		if (val1 < val2) {
			if (val1 <= 0) {
				result = val2;
			} else {
				result = val1;
			}
		} else {
			if (val2 <= 0) {
				result = val1;
			} else {
				result = val2;
			}
		}
		return result <= 0 ? 1 : result;
	};

	/**
	 * REFLECTION function: no reflection at all
	 */
	RainyDay.prototype.REFLECTION_NONE = function() {
		this.context.fillStyle = this.options.fillStyle;
		this.context.fill();
	};

	/**
	 * REFLECTION function: miniature reflection (default)
	 * @param drop raindrop object
	 */
	RainyDay.prototype.REFLECTION_MINIATURE = function(drop) {
		var sx = Math.max((drop.x - this.options.reflectionDropMappingWidth) / this.options.reflectionScaledownFactor, 0);
		var sy = Math.max((drop.y - this.options.reflectionDropMappingHeight) / this.options.reflectionScaledownFactor, 0);
		var sw = this.positiveMin(this.options.reflectionDropMappingWidth * 2 / this.options.reflectionScaledownFactor, this.reflected.width - sx);
		var sh = this.positiveMin(this.options.reflectionDropMappingHeight * 2 / this.options.reflectionScaledownFactor, this.reflected.height - sy);
		var dx = Math.max(drop.x - 1.1 * drop.r, 0);
		var dy = Math.max(drop.y - 1.1 * drop.r, 0);
		this.context.drawImage(this.reflected, sx, sy, sw, sh, dx, dy, drop.r * 2, drop.r * 2);
	};

	/**
	 * COLLISION function: default collision implementation
	 * @param drop one of the drops colliding
	 * @param collisions list of potential collisions
	 */
	RainyDay.prototype.COLLISION_SIMPLE = function(drop, collisions) {
		var item = collisions;
		var drop2;
		while (item != null) {
			var p = item.drop;
			if (Math.sqrt(Math.pow(drop.x - p.x, 2) + Math.pow(drop.y - p.y, 2)) < (drop.r + p.r)) {
				drop2 = p;
				break;
			}
			item = item.next;
		}

		if (!drop2) {
			return;
		}

		// rename so that we're dealing with low/high drops
		var higher,
			lower;
		if (drop.y > drop2.y) {
			higher = drop;
			lower = drop2;
		} else {
			higher = drop2;
			lower = drop;
		}

		this.clearDrop(lower);
		// force stopping the second drop
		this.clearDrop(higher, true);
		this.matrix.remove(higher);
		lower.draw();

		lower.colliding = higher;
		lower.collided = true;
	};

	/**
	 * Resizes canvas
	 */
	RainyDay.prototype.prepareBackground = function() {
		this.background = this.background || document.createElement('canvas');
		this.background.width = this.canvas.width;
		this.background.height = this.canvas.height;

		this.clearbackground = this.clearbackground || document.createElement('canvas');
		this.clearbackground.width = this.canvas.width;
		this.clearbackground.height = this.canvas.height;

		var context = this.background.getContext('2d');
		context.clearRect(0, 0, this.canvas.width, this.canvas.height);

		context = this.clearbackground.getContext('2d');
		context.clearRect(0, 0, this.canvas.width, this.canvas.height);
	};

	/**
	 * Defines a gravity matrix object which handles collision detection.
	 * @param x number of columns in the matrix
	 * @param y number of rows in the matrix
	 * @param r grid size
	 */
	function CollisionMatrix(x, y, r) {
		this.resolution = r;
		this.xc = x;
		this.yc = y;
		this.matrix = new Array(x);
		for (var i = 0; i <= (x + 5); i++) {
			this.matrix[i] = new Array(y);
			for (var j = 0; j <= (y + 5); ++j) {
				this.matrix[i][j] = new DropItem(null);
			}
		}
	}

	/**
	 * Updates position of the given drop on the collision matrix.
	 * @param drop raindrop to be positioned/repositioned
	 * @param forceDelete if true the raindrop will be removed from the matrix
	 * @returns collisions if any
	 */
	CollisionMatrix.prototype.update = function(drop, forceDelete) {
		if (drop.gid) {
			if (!this.matrix[drop.gmx] || !this.matrix[drop.gmx][drop.gmy]) {
				return null;
			}
			this.matrix[drop.gmx][drop.gmy].remove(drop);
			if (forceDelete) {
				return null;
			}

			drop.gmx = Math.floor(drop.x / this.resolution);
			drop.gmy = Math.floor(drop.y / this.resolution);
			if (!this.matrix[drop.gmx] || !this.matrix[drop.gmx][drop.gmy]) {
				return null;
			}
			this.matrix[drop.gmx][drop.gmy].add(drop);

			var collisions = this.collisions(drop);
			if (collisions && collisions.next != null) {
				return collisions.next;
			}
		} else {
			drop.gid = Math.random().toString(36).substr(2, 9);
			drop.gmx = Math.floor(drop.x / this.resolution);
			drop.gmy = Math.floor(drop.y / this.resolution);
			if (!this.matrix[drop.gmx] || !this.matrix[drop.gmx][drop.gmy]) {
				return null;
			}

			this.matrix[drop.gmx][drop.gmy].add(drop);
		}
		return null;
	};

	/**
	 * Looks for collisions with the given raindrop.
	 * @param drop raindrop to be checked
	 * @returns DropItem list of drops that collide with it
	 */
	CollisionMatrix.prototype.collisions = function(drop) {
		var item = new DropItem(null);
		var first = item;

		item = this.addAll(item, drop.gmx - 1, drop.gmy + 1);
		item = this.addAll(item, drop.gmx, drop.gmy + 1);
		item = this.addAll(item, drop.gmx + 1, drop.gmy + 1);

		return first;
	};

	/**
	 * Appends all found drop at a given location to the given item.
	 * @param to item to which the results will be appended to
	 * @param x x position in the matrix
	 * @param y y position in the matrix
	 * @returns last discovered item on the list
	 */
	CollisionMatrix.prototype.addAll = function(to, x, y) {
		if (x > 0 && y > 0 && x < this.xc && y < this.yc) {
			var items = this.matrix[x][y];
			while (items.next != null) {
				items = items.next;
				to.next = new DropItem(items.drop);
				to = to.next;
			}
		}
		return to;
	};

	/**
	 * Removed the drop from its current position
	 * @param drop to be removed
	 */
	CollisionMatrix.prototype.remove = function(drop) {
		this.matrix[drop.gmx][drop.gmy].remove(drop);
	};

	/**
	 * Defines a linked list item.
	 */
	function DropItem(drop) {
		this.drop = drop;
		this.next = null;
	}

	/**
	 * Adds the raindrop to the end of the list.
	 * @param drop raindrop to be added
	 */
	DropItem.prototype.add = function(drop) {
		var item = this;
		while (item.next != null) {
			item = item.next;
		}
		item.next = new DropItem(drop);
	};

	/**
	 * Removes the raindrop from the list.
	 * @param drop raindrop to be removed
	 */
	DropItem.prototype.remove = function(drop) {
		var item = this;
		var prevItem = null;
		while (item.next != null) {
			prevItem = item;
			item = item.next;
			if (item.drop.gid === drop.gid) {
				prevItem.next = item.next;
			}
		}
	};

	return RainyDay;
}));
