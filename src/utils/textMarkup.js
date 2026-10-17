const MARKUP_TAGS = ['bold', 'semibold', 'italic', 'underlined'];

const areStylesEqual = (left, right) =>
  MARKUP_TAGS.every((tag) => left[tag] === right[tag]);

const appendRun = (runs, text, style) => {
  if (!text) return;
  const previous = runs[runs.length - 1];
  if (previous && areStylesEqual(previous, style)) previous.text += text;
  else runs.push({ ...style, text });
};

export const hasTextMarkup = (value) => /<\/?(?:bold|semibold|italic|underlined)>/i.test(String(value));

export const parseTextMarkup = (value) => {
  const runs = [];
  const tokens = String(value ?? '').split(/(<\/?(?:bold|semibold|italic|underlined)>)/gi);
  const depths = Object.fromEntries(MARKUP_TAGS.map((tag) => [tag, 0]));

  tokens.forEach((token) => {
    const match = token.match(/^<(\/)?(bold|semibold|italic|underlined)>$/i);
    if (match) {
      const tag = match[2].toLowerCase();
      depths[tag] = match[1] ? Math.max(0, depths[tag] - 1) : depths[tag] + 1;
      return;
    }
    if (token) appendRun(runs, token, Object.fromEntries(MARKUP_TAGS.map((tag) => [tag, depths[tag] > 0])));
  });

  return runs;
};

export const wrapStyledText = (doc, fontForRun, text, width) => {
  const paragraphs = [[]];
  let words = [];
  let currentWord = [];
  let spaceBefore = false;
  let spaceStyle = {};

  const finishWord = () => {
    if (!currentWord.length) return;
    words.push({ runs: currentWord, spaceBefore, spaceStyle });
    currentWord = [];
    spaceBefore = false;
  };

  const finishParagraph = () => {
    finishWord();
    paragraphs[paragraphs.length - 1] = words;
    words = [];
    paragraphs.push([]);
    spaceBefore = false;
  };

  parseTextMarkup(text).forEach((run) => {
    Array.from(run.text.replace(/\r\n?/g, '\n')).forEach((character) => {
      if (character === '\n') {
        finishParagraph();
      } else if (/\s/u.test(character)) {
        finishWord();
        if (words.length) {
          spaceBefore = true;
          spaceStyle = run;
        }
      } else {
        appendRun(currentWord, character, run);
      }
    });
  });
  finishWord();
  paragraphs[paragraphs.length - 1] = words;
  if (paragraphs[paragraphs.length - 1].length === 0 && paragraphs.length > 1) paragraphs.pop();

  const measure = (runs) =>
    runs.reduce((total, run) => {
      doc.font(fontForRun(run));
      return total + doc.widthOfString(run.text);
    }, 0);

  const lines = [];
  paragraphs.forEach((paragraphWords) => {
    if (!paragraphWords.length) {
      lines.push({ runs: [], lastInParagraph: true });
      return;
    }

    let lineRuns = [];
    const flushLine = () => {
      lines.push({ runs: lineRuns, lastInParagraph: false });
      lineRuns = [];
    };

    paragraphWords.forEach((word) => {
      const candidate = lineRuns.map((run) => ({ ...run }));
      if (candidate.length && word.spaceBefore) appendRun(candidate, ' ', word.spaceStyle);
      word.runs.forEach((run) => appendRun(candidate, run.text, run));

      if (measure(candidate) <= width) {
        lineRuns = candidate;
        return;
      }
      if (lineRuns.length) flushLine();
      if (measure(word.runs) <= width) {
        lineRuns = word.runs.map((run) => ({ ...run }));
        return;
      }

      let segment = [];
      word.runs.forEach((run) => {
        for (const character of Array.from(run.text)) {
          const nextSegment = segment.map((item) => ({ ...item }));
          appendRun(nextSegment, character, run);
          if (segment.length && measure(nextSegment) > width) {
            lines.push({ runs: segment, lastInParagraph: false });
            segment = [{ ...run, text: character }];
          } else {
            segment = nextSegment;
          }
        }
      });
      lineRuns = segment;
    });

    if (lineRuns.length) lines.push({ runs: lineRuns, lastInParagraph: true });
    else if (lines.length) lines[lines.length - 1].lastInParagraph = true;
  });

  return lines.length ? lines : [{ runs: [], lastInParagraph: true }];
};
