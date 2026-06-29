/**
 * auth.js — Re-export shim for backward compatibility
 *
 * This file has been relocated to load-tests/shared/helpers/auth.js.
 * This shim re-exports all functions from the new location to support
 * any scripts that still reference the old path.
 *
 * @deprecated Use '../shared/helpers/auth.js' directly instead.
 */

'use strict';

const { getUser, getToken, getAuthHeaders } = require('../shared/helpers/auth.js');

module.exports = { getUser, getToken, getAuthHeaders };
