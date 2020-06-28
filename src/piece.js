const vector = require('./vector');
const {Anchor} = require('./anchor');
const {None} = require('./structure')
const connector = require('./connector')


/**
 * @callback TranslationListener
 * @param {Piece} piece
 * @param {number} dx
 * @param {number} dy
 */

/**
 * @callback ConnectionListener
 * @param {Piece} piece
 * @param {Piece} target
 */

 /**
  * A jigsaw piece
  */
 class Piece {

  /**
   * @param {import('./../src/structure').Structure} [options]
   */
  constructor({up = None, down = None, left = None, right = None} = {}) {
    this.up = up;
    this.down = down;
    this.left = left;
    this.right = right;
    this._initializeListeners();
  }

  _initializeListeners() {
    /** @type {TranslationListener[]} */
    this.translateListeners = [];
    /** @type {ConnectionListener[]} */
    this.connectListeners = [];
    /** @type {ConnectionListener[]} */
    this.disconnectListeners = [];
  }

  /**
   * Sets unestructured user-defined metadata on this piece
   *
   * @param {object} metadata
   */
  annotate(metadata) {
    this.metadata = metadata;
  }

  /**
   * @param {import('./puzzle')} puzzle
   */
  belongTo(puzzle) {
    this.puzzle = puzzle;
  }

  /**
   * @returns {Piece[]}
   */
  get connections() {
    return [
      this.upConnection,
      this.downConnection,
      this.leftConnection,
      this.rightConnection
    ].filter(it => it);
  }

  /**
   * @param {TranslationListener} f the callback
   */
  onTranslate(f) {
    this.translateListeners.push(f);
  }

  /**
   * @param {ConnectionListener} f the callback
   */
  onConnect(f) {
    this.connectListeners.push(f);
  }

  /**
   * @param {ConnectionListener} f the callback
   */
  onDisconnect(f) {
    this.disconnectListeners.push(f);
  }

  /**
   * @param {number} dx
   * @param {number} dy
   */
  fireTranslate(dx, dy) {
    this.translateListeners.forEach(it => it(this, dx, dy))
  }

  /**
   * @param {Piece} other
   */
  fireConnect(other) {
    this.connectListeners.forEach(it => it(this, other))
  }

    /**
   * @param {Piece[]} others
   */
  fireDisconnect(others) {
    others.forEach(other => {
      this.disconnectListeners.forEach(it => it(this, other))
    });
  }

  /**
   *
   * @param {Piece} other
   * @param {boolean} [back]
   */
  connectVerticallyWith(other, back = false) {
    connector.vertical.connectWith(this, other, this.proximity, back);
  }

  /**
   * @param {Piece} other
   */
  attractVertically(other, back = false) {
    connector.vertical.attract(this, other, back);
  }

  /**
   * @param {Piece} other
   * @param {boolean} [back]
   */
  connectHorizontallyWith(other, back = false) {
    connector.horizontal.connectWith(this, other, this.proximity, back);
  }

  /**
   * @param {Piece} other
   */
  attractHorizontally(other, back = false) {
    connector.horizontal.attract(this, other, back);
  }

  /**
   * @param {Piece} other
   * @param {boolean} [back]
   */
  tryConnectWith(other, back = false) {
    this.tryConnectHorizontallyWith(other, back);
    this.tryConnectVerticallyWith(other, back);
  }

  /**
   *
   * @param {Piece} other
   * @param {boolean} [back]
   */
  tryConnectHorizontallyWith(other, back = false) {
    if (this.canConnectHorizontallyWith(other)) {
      this.connectHorizontallyWith(other, back);
    }
  }
  /**
   *
   * @param {Piece} other
   * @param {boolean} [back]
   */
  tryConnectVerticallyWith(other, back = false) {
    if (this.canConnectVerticallyWith(other)) {
      this.connectVerticallyWith(other, back);
    }
  }

  disconnect() {
    if (!this.connected) {
      return;
    }
    const connections = this.connections;

    if (this.upConnection) {
      this.upConnection.downConnection = null;
      /** @type {Piece} */
      this.upConnection = null;
    }

    if (this.downConnection) {
      this.downConnection.upConnection = null;
      this.downConnection = null;
    }

    if (this.leftConnection) {
      this.leftConnection.rightConnection = null;
      /** @type {Piece} */
      this.leftConnection = null;
    }

    if (this.rightConnection) {
      this.rightConnection.leftConnection = null;
      this.rightConnection = null;
    }

    this.fireDisconnect(connections);
  }

  /**
   *
   * @param {Anchor} anchor
   */
  placeAt(anchor) {
    const previous = this.centralAnchor;
    this.centralAnchor = anchor;

    if (previous) {
      const delta = anchor.diff(previous);
      this.fireTranslate(...delta);
    }
  }

  /**
   *
   * @param {number} dx
   * @param {number} dy
   */
  translate(dx, dy, quiet = false) {
    if (!vector.isNull(dx, dy)) {
      this.centralAnchor.translate(dx, dy);
      if (!quiet) {
        this.fireTranslate(dx, dy);
      }
    }
  }

  /**
   *
   * @param {number} dx
   * @param {number} dy
   * @param {boolean} [quiet]
   * @param {Piece[]} [pushedPieces]
   */
  push(dx, dy, quiet = false, pushedPieces = [this]) {
    this.translate(dx, dy, quiet);

    const stationaries = this.connections.filter(it => pushedPieces.indexOf(it) === -1);
    pushedPieces.push(...stationaries);
    stationaries.forEach(it => it.push(dx, dy, false, pushedPieces));
  }

  /**
   *
   * @param {number} dx
   * @param {number} dy
   */
  drag(dx, dy, quiet = false) {
    if (vector.isNull(dx, dy)) return;

    if (this.horizontallyOpenMovement(dx) && this.vericallyOpenMovement(dy)) {
      this.disconnect();
      this.translate(dx, dy, quiet);
    } else {
      this.push(dx, dy, quiet);
    }
  }

  drop() {
    this.puzzle.autoconnectWith(this);
  }

  dragAndDrop(dx, dy) {
    this.drag(dx, dy);
    this.drop();
  }

  /**
   *
   * @param {number} dy
   * @returns {boolean}
   */
  vericallyOpenMovement(dy) {
    return connector.vertical.openMovement(this, dy);
  }

  /**
   *
   * @param {number} dx
   * @returns {boolean}
   */
  horizontallyOpenMovement(dx) {
    return connector.horizontal.openMovement(this, dx);
  }

  /**
   *
   * @param {Piece} other
   * @returns {boolean}
   */
  canConnectHorizontallyWith(other) {
    return connector.horizontal.canConnectWith(this, other, this.proximity);
  }

  /**
   *
   * @param {Piece} other
   * @returns {boolean}
   */
  canConnectVerticallyWith(other) {
    return connector.vertical.canConnectWith(this, other, this.proximity);
  }

  /**
   *
   * @param {Piece} other
   * @returns {boolean}
   */
  verticallyCloseTo(other) {
    return connector.vertical.closeTo(this, other, this.proximity);
  }

  /**
   *
   * @param {Piece} other
   * @returns {boolean}
   */
  horizontallyCloseTo(other) {
    return connector.horizontal.closeTo(this, other, this.proximity);
  }


  /**
   *
   * @param {Piece} other
   * @returns {boolean}
   */
  verticallyMatch(other) {
    return connector.vertical.match(this, other);
  }

  /**
   *
   * @param {Piece} other
   * @returns {boolean}
   */
  horizontallyMatch(other) {
    return connector.horizontal.match(this, other);
  }

  get connected() {
    return this.upConnection || this.rightConnection || this.leftConnection || this.rightConnection;
  }

  /**
   * @return {Anchor}
   */
  get downAnchor() {
    return this.centralAnchor.translated(0, this.size);
  }

  /**
   * @return {Anchor}
   */
  get rightAnchor() {
    return this.centralAnchor.translated(this.size, 0);
  }

  /**
   * @return {Anchor}
   */
  get upAnchor() {
    return this.centralAnchor.translated(0, -this.size);
  }

  /**
   * @return {Anchor}
   */
  get leftAnchor() {
    return this.centralAnchor.translated(-this.size, 0);
  }

  /**
   * @return {number}
   */
  get size() {
    return this.puzzle.pieceSize;
  }

  /**
   * @returns {number}
   */
  get proximity() {
    return this.puzzle.proximity;
  }
}

/**
 * @module Piece
 */
module.exports = Piece;
