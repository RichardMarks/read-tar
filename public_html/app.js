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
        // window.console.dir(arr);
        const str = String.fromCharCode.apply(null, arr);
        // window.console.info(str);
        return str;
      },
      n: function (length) { return parseInt(parser.s(length), 8); },
    };
    function parseField(name, type, length) {
      header[name] = parser[type](length);
      // window.console.log(name + ': ' + header[name]);
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
      typeflag: { s: 1 },
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
      padding: { s: 12 },
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

  function TarFileEntry() {}

  function TarFile(dataView) {
    this._dataView = dataView;
    this._position = 0;
  }
  TarFile.prototype = Object.create({});
  TarFile.prototype.constructor = TarFile;
  TarFile.prototype.hasData = function hasData() {
    return this._position + 4 < this._dataView.byteLength && this._dataView.getUint32(this._position, true) !== 0;
  };
  TarFile.prototype.extract = function extract() {
    const file = new TarFileEntry();
    const headerStartPosition = this._position;
    const dataStartPosition = headerStartPosition + 512;
    const header = new TarHeader();
    this._position = header.parse(this._dataView, this._position);
    file.header = header;

    const type = header.typeflag;
    if (type === '0' || type === '\0') {
      file.buffer = this._dataView.buffer.slice(this._position, this._position + header.size);
      this._position += header.size;
    }

    let dataEndPosition = dataStartPosition + header.size;
    const szModBlock = header.size % 512;
    if (szModBlock !== 0) {
      dataEndPosition += (512 - szModBlock);
    }
    this._position = dataEndPosition;
    return file;
  };

  function Tar() {}
  Tar.prototype = Object.create({});
  Tar.prototype.constructor = Tar;
  Tar.prototype.parse = function (dataView) {
    const tar = this;
    tar.files = [];
    return new Promise(function (resolve, reject) {
      try {
        const tarFile = new TarFile(dataView);
        while (tarFile.hasData()) {
          const file = tarFile.extract();
          if (file.header.typeflag === '0' || file.header.typeflag === '\0') {
            tar.files.push(file);
          }
        }
      } catch (err) { reject(err); }
      resolve(tar.files);
    });
  };

  function main() {
    // create a simple display for the content listing
    const contentDiv = document.createElement('div');
    contentDiv.id = 'content';
    document.body.insertBefore(contentDiv, document.body.firstChild);
    // create the input form
    const btn = document.createElement('button');
    btn.innerHTML = 'Browse...';
    document.body.appendChild(btn);
    btn.addEventListener('click', function () {
      browseForFile().then(function (contents) {
        contentDiv.innerHTML = '';
        // create a file reader
        const reader = new FileReader();
        reader.onload = function (readerEvent) {
          window.console.log('Reading ' + contents.name);
          // result is an ArrayBuffer containing the contents of the file
          const result = readerEvent.target.result;
          const dataView = new DataView(result);
          const tar = new Tar();

          const pre = document.createElement('pre');
          pre.innerHTML = hexdump(result);
          document.body.appendChild(pre);

          tar.parse(dataView).then(function (files) {
            files.forEach(function (file, index) {
              const entryDiv = document.createElement('div');
              entryDiv.id = 'entry_' + index;
              entryDiv.innerHTML = [
                'Filename: ' + file.header.name,
                'Filesize: ' + file.header.size + ' bytes',
                '<pre>Data: ' + hexdump(file.buffer) + '</pre>',
              ].join('<br />');
              contentDiv.appendChild(entryDiv);
              window.console.dir(file);
            });
          }).catch(function (err) { window.console.error(err); });
        };
        reader.readAsArrayBuffer(contents);

      }).catch(function (err) { window.console.error(err); });
    }, false);
  }

  document.addEventListener('DOMContentLoaded', main, false);
}());
