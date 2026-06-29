"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateConnectionKey = void 0;
const generateConnectionKey = (userA, userB) => {
    const user1 = userA < userB ? userA : userB;
    const user2 = userA < userB ? userB : userA;
    return `${user1}_${user2}`;
};
exports.generateConnectionKey = generateConnectionKey;
