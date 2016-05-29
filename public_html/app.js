// app.js
(function (){
  'use strict';

  // hexdump lifted from https://github.com/bma73/hexdump-js/blob/master/index.js
  var hexdump = (function () {
    var _fillUp = function (value, count, fillWith) {
        var l = count - value.length;
        var ret = "";
        while (--l > -1)
            ret += fillWith;
        return ret + value;
    },
    hexdump = function (arrayBuffer, offset, length) {
        var view = new DataView(arrayBuffer);
        offset = offset || 0;
        length = length || arrayBuffer.byteLength;
        var out = _fillUp("Offset", 8, " ") + "  00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F\n";
        var row = "";
        for (var i = 0; i < length; i += 16) {
            row += _fillUp(offset.toString(16).toUpperCase(), 8, "0") + "  ";
            var n = Math.min(16, length - offset);
            var string = "";
            for (var j = 0; j < 16; ++j) {
                if (j < n) {
                    var value = view.getUint8(offset);
                    string += value >= 32 ? String.fromCharCode(value) : ".";
                    row += _fillUp(value.toString(16).toUpperCase(), 2, "0") + " ";
                    offset++;
                }
                else {
                    row += "   ";
                    string += " ";
                }
            }
            row += " " + string + "\n";
        }
        out += row;
        return out;
    };
    return hexdump;
  })();

  function browseForFile() {
    return new Promise(function (resolve) {
      const element = document.createElement('input');
      element.type = 'file';
      element.addEventListener('change', function () {
        const files = element.files;
        if (files.length) {
          return resolve(element.files[0]);
        }
      }, false);
      element.click();
    });
  }

  function TarHeader() {}
  TarHeader.prototype = Object.create({});
  TarHeader.prototype.constructor = TarHeader;
  TarHeader.prototype.parse = function (dataView, position) {
    const header = this;
    const parser = {
      position: position,
      s: function (length) {
        const arr = [];
        for (var i = 0; i < length; i += 1) {
          arr.push(dataView.getUint8(parser.position));
          parser.position += 1;
        }
        return String.fromCharCode.apply(null, arr);
      },
      n: function (length) { return parseInt(parser.s(length), 8); },
    };
    function parseField(name, type, length) {
      header[name] = parser[type](length);
      window.console.log(name + ': ' + header[name]);
      // window.console.log([
      //   'parseField(name="' + name + '", type="' + (type === 's' ? 'string' : 'number') + '", length=' + length + ')',
      //   '\t' + name + ': ' + header[name]].join('\n'));
    }
    // tar Header Block, from POSIX 1003.1-1990.
    // The name, linkname, magic, uname, and gname are null-terminated character strings.
    // All other fields are zero-filled octal numbers in ASCII.
    // Each numeric field of width w contains w minus 1 digits, and a null.

    // struct posix_header
    // {                               /* byte offset */
    const posixHeader = {
    //   char name[100];               /*   0 */
      name: { s: 100 },
    //   char mode[8];                 /* 100 */
      mode: { n: 8 },
    //   char uid[8];                  /* 108 */
      uid: { n: 8 },
    //   char gid[8];                  /* 116 */
      gid: { n: 8 },
    //   char size[12];                /* 124 */
      size: { n: 12 },
    //   char mtime[12];               /* 136 */
      mtime: { n: 12 },
    //   char chksum[8];               /* 148 */
      chksum: { n: 8 },
    //   char typeflag;                /* 156 */
      typeflag: { n: 1 },
    //   char linkname[100];           /* 157 */
      linkname: { s: 100 },
    //   char magic[6];                /* 257 */
      magic: { s: 6 },
    //   char version[2];              /* 263 */
      version: { n: 2 },
    //   char uname[32];               /* 265 */
      uname: { s: 32 },
    //   char gname[32];               /* 297 */
      gname: { s: 32 },
    //   char devmajor[8];             /* 329 */
      devmajor: { n: 8 },
    //   char devminor[8];             /* 337 */
      devminor: { n: 8 },
    //   char prefix[155];             /* 345 */
      prefix: { s: 155 },
    //                                 /* 500 */
    };
    // };

    Object.keys(posixHeader).forEach(function (fieldName) {
      const fieldDescriptor = posixHeader[fieldName];
      if (fieldDescriptor.s) {
        parseField(fieldName, 's', fieldDescriptor.s);
      } else {
        parseField(fieldName, 'n', fieldDescriptor.n);
      }
    });

    return parser.position;
  };

  function main() {

    // create the input form
    const btn = document.createElement('button');
    btn.innerHTML = 'Browse...';
    document.body.appendChild(btn);
    btn.addEventListener('click', function () {
      browseForFile().then(function (contents) {
        // create a file reader
        const reader = new FileReader();
        reader.onload = function (readerEvent) {
          window.console.log('Reading ' + contents.name);
          // result is an ArrayBuffer containing the contents of the file
          const result = readerEvent.target.result;
          // window.console.dir(result);
          // create a data view for reading the file header
          const pre = document.createElement('pre');
          pre.innerHTML = hexdump(result);
          document.body.appendChild(pre);
          const dataView = new DataView(result);
          // window.console.dir(dataView);
          // parse the tar header
          const header = new TarHeader();
          const position = header.parse(dataView, 0);
          // window.console.log('parser position is ' + position);


        };
        reader.readAsArrayBuffer(contents);



        // window.console.info('Tar File Contents:');
        // window.console.dir(contents);
      }).catch(function (err) { window.console.error(err); });
    }, false);
  }

  document.addEventListener('DOMContentLoaded', main, false);
}());
