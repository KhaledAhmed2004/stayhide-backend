/**
 * scenario-utils.js — Re-export shim for backward compatibility
 *
 * This file has been relocated to load-tests/shared/helpers/scenario-utils.js.
 * This shim re-exports all functions from the new location to support
 * any scripts that still reference the old path.
 *
 * @deprecated Use '../shared/helpers/scenario-utils.js' directly instead.
 */

'use strict';

const { getStressStages, getSoakStages, classifyPhase, resolveBaseUrl } = require('../shared/helpers/scenario-utils.js');

module.exports = { getStressStages, getSoakStages, classifyPhase, resolveBaseUrl };
