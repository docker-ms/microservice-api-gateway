'use strict';

class Util {

  static pickRandomly(candidatesArr) {
    if (!candidatesArr || !Array.isArray(candidatesArr) || candidatesArr.length === 0) {
      throw new Error('Parameter must be a nonempty candiates array.');
    }

    if (candidatesArr.length === 1) {
      return candidatesArr[0];
    }

    return candidatesArr[Math.floor(Math.random() * candidatesArr.length)];
  }

}

module.exports = Util;


