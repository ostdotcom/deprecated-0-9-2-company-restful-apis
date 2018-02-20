
// USAGE : refer to : https://www.npmjs.com/package/jimp

const Jimp = require("jimp");

const rootPrefix = '.'
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

const imageFileName = '/Users/PpuneetKhushwani/Desktop/828544_p.jpg';
const foneFileName = Jimp.FONT_SANS_32_WHITE;

var outputFileName = '/Users/PpuneetKhushwani/Desktop/828544_p_1.jpg';

var imageCaption = 'FPC';

var rawImage = null;
var fontFile = null;

function readFromFile() {
  return Jimp.read(imageFileName).then(function(image){
    logger.debug('image loaded');
    rawImage = image;
    return Promise.resolve({});
  });
}

function loadFontFile() {
  return Jimp.loadFont(foneFileName).then(function(font){
    logger.debug('font file loaded');
    fontFile = font;
    return Promise.resolve({});
  });
}

function modifyImage() {

  var printCb = function() {
    logger.debug('test written to image');
    rawImage.write(outputFileName, writeCb);
  };

  var writeCb = function() {
    logger.debug('image written to file');
    return Promise.resolve({});
  };

  return rawImage.print(fontFile, 200, 200, imageCaption, printCb);

}

readFromFile()
    .then( loadFontFile )
    .then( modifyImage )
    .catch(function(e){
      logger.notify('t_i_p_1','error while reading from file', e);
    });
