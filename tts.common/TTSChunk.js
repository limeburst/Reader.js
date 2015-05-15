// TTSChunk

function TTSChunk(/*Array<TTSPiece>*/pieces) {
  this.init(pieces); 
}

TTSChunk.prototype = {
  range: null,

  init: function(/*Array<TTSPiece>*/pieces) {
    if (pieces === undefined)
      throw 'TTSChunk: piece list is invalid.';

    this.id = tts.chunks.length;
    this.pieces = pieces;
    this.range = new TTSRange(0, this.getText().length);

    setReadOnly(this, ['id', 'pieces'], true);
  },

  getText: function() {
    var fullText = '',
        range = this.range;

    this.pieces.forEach(function(piece) {
      fullText += piece.text;
    });

    if (range !== null)
      return fullText.substring(range.startOffset, range.endOffset);
    else
      return fullText;
  },

  getUtterance: function() {
    return new TTSUtterance(this.getText())
              .removeNewLine()
              .removeHanja()
              .removeLatin()
              .replaceTilde()
              .replaceNumeric()
              .replaceBracket()
              .replaceEqual()
              .replaceDate()
              .insertPauseTag();
  },

  getPiece: function(/*Number*/offset) {
    var length = 0;
    return this.pieces.find(function(item) {
      length += item.length;
      if (offset <= length)
        return true;
    });
  },

  getOffset: function(/*Number*/piece) {
    var offset = piece.paddingLeft;
    return this.pieces.find(function(item) {
      if (item === piece)
        return true;
      else {
        offset += item.length;
        return false;
      }
    });
  },

  getClientRects: function(/*Boolean*/removeBlank) {
    var rects = [],
        chunkRange = this.range,
        pieces = this.pieces,
        startOffset, endOffset,
        offset = 0, length = 0,
        startPiece = this.getPiece(chunkRange.startOffset);

    for (var i = 0; i < pieces.length; i++, offset += length) {
      var piece = pieces[i],
          text = piece.text,
          node = piece.node,
          string = null;

      var range = document.createRange();
      range.selectNodeContents(node);
      if (piece.isInvalid()) {
        length = 0;

        var rect = epub.getBoundingClientRect(range);
        if (rect !== null) {
          rects.push(rect);
        }
      } else {
        length = piece.length;

        var pieceRange = new TTSRange(offset, offset + piece.length);
        if (chunkRange.startOffset <= pieceRange.startOffset) {
          if (pieceRange.endOffset <= chunkRange.endOffset) {
            // Case 1
            //   Chunk |        |
            //   Piece |   |
            //   Piece   |   |
            //   Piece     |    |
            startOffset = pieceRange.startOffset;
            endOffset = pieceRange.endOffset;
          } else {
            if (chunkRange.endOffset <= pieceRange.startOffset) {
              // Case 2
              //   Chunk |   |
              //   Piece        |    |
              continue;
            } else {
              // Case 3
              //   Chunk |     |
              //   Piece    |       |
              startOffset = pieceRange.startOffset;
              endOffset = this.range.endOffset;
            }
          }
        } else if (chunkRange.endOffset <= pieceRange.endOffset) {
          // Case 4
          //   Chunk    |   |
          //   Piece |          |
          //   Piece   |    |
          startOffset = this.range.startOffset;
          endOffset = this.range.endOffset;
        } else {
          if (pieceRange.endOffset <= chunkRange.startOffset) {
            // Case 5
            //   Chunk         |   |
            //   Piece |    |
            continue;
          } else {
            // Case 6
            //   Chunk     |       |
            //   Piece |      |
            startOffset = this.range.startOffset;
            endOffset = pieceRange.endOffset;
          }
        }

        startOffset = Math.max(startOffset - offset + piece.paddingLeft, 0);
        endOffset = Math.max(endOffset - offset + piece.paddingLeft, 0);
        if (endOffset === 0)
          endOffset = length;
        while (true) {
          try {
            range.setStart(node, startOffset);
            range.setEnd(node, endOffset);
            range.expand('character');
          } catch (e) {
            console.log('TTSChunk:getClientRects() Error!! ' + e.toString());
            console.log('=> {chunkId: ' + this.id
                        + ', startOffset: ' + startOffset
                        + ', endOffset: ' + endOffset
                        + ', offset: ' + offset
                        + ', nodeIndex: ' + piece.nodeIndex
                        + ', wordIndex: ' + piece.wordIndex + '}');
            break;
          }

          // 앞뒤 여백을 없애서 하이라이트를 이쁘게 만들어보자.
          string = range.toString();
          if (startPiece.nodeIndex == piece.nodeIndex &&
              (string.match(regexWhitespaceAndNewLine('^', null, 'g')) !== null || 
               string.match(regexSentence('^', null, 'g')) !== null)) {
            if (length < startOffset + 1)
              break;
            startOffset++;
          } else if (string.match(regexWhitespaceAndNewLine(null, '$', 'g')) !== null) {
            if (endOffset - 1 < 0)
              break;
            endOffset--;
          } else
            break;
        }// end while

        if (removeBlank === true && string.length === 0)
          continue;

        var textNodeRects = range.getClientRects();
        if (textNodeRects !== null) {
          for (var j = 0; j < textNodeRects.length; j++)
            rects.push(textNodeRects[j]);
        }
      }
    }// end for
    return rects;
  },

  copy: function(/*TTSRange*/range) {
    var newChunk = new TTSChunk(this.pieces);
    newChunk.range = range;
    return newChunk;
  }
};