"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.labelController = void 0;
// Wrap controller handlers to auto-set controller/service labels in res.locals
const labelController = (controller, controllerName, serviceMap) => {
    const wrapped = {};
    for (const [key, value] of Object.entries(controller)) {
        if (typeof value === 'function') {
            const original = value;
            const labeled = (req, res, next) => {
                try {
                    // Set controller label automatically from controller name + method key
                    res.locals.controllerLabel = `${controllerName}.${key}`;
                    // If a service label mapping is provided, set it
                    const svc = serviceMap === null || serviceMap === void 0 ? void 0 : serviceMap[key];
                    if (svc)
                        res.locals.serviceLabel = svc;
                }
                catch (_a) {
                    // no-op
                }
                return original(req, res, next);
            };
            wrapped[key] = labeled;
        }
        else {
            wrapped[key] = value;
        }
    }
    return wrapped;
};
exports.labelController = labelController;
