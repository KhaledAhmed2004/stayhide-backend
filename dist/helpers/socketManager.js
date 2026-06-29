"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketManager = void 0;
let _io = null;
/**
 * Typed SocketManager singleton.
 *
 * Usage:
 *   // In server.ts, after creating the Socket.io server:
 *   SocketManager.init(io);
 *
 *   // Anywhere else in the app:
 *   const io = SocketManager.getIO();
 */
exports.SocketManager = {
    /**
     * Initialise the singleton with the Socket.io server instance.
     * Must be called once during application startup before any call to getIO().
     */
    init(io) {
        _io = io;
    },
    /**
     * Return the initialised Socket.io server instance.
     *
     * @throws {Error} If called before init().
     */
    getIO() {
        if (!_io) {
            throw new Error('SocketManager: Socket.io server has not been initialized. Call SocketManager.init(io) first.');
        }
        return _io;
    },
};
