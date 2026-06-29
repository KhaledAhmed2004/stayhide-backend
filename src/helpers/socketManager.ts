import { Server } from 'socket.io';

let _io: Server | null = null;

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
export const SocketManager = {
  /**
   * Initialise the singleton with the Socket.io server instance.
   * Must be called once during application startup before any call to getIO().
   */
  init(io: Server): void {
    _io = io;
  },

  /**
   * Return the initialised Socket.io server instance.
   *
   * @throws {Error} If called before init().
   */
  getIO(): Server {
    if (!_io) {
      throw new Error(
        'SocketManager: Socket.io server has not been initialized. Call SocketManager.init(io) first.'
      );
    }
    return _io;
  },
};
