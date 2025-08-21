(function () {
  // 0) 検索対象ドキュメントを用意（現在のdocument＋同一オリジンiframe）
  const docs = [document];
  document.querySelectorAll('iframe').forEach(f => {
    try {
      if (f.contentDocument) docs.push(f.contentDocument);
    } catch (e) { /* クロスオリジンは無視 */ }
  });

  // 1) すべてのチェック済みcheckboxを集約
  const allChecked = docs.flatMap(d =>
    Array.from(d.querySelectorAll('input[type="checkbox"]:checked')).map(cb => ({ cb, d }))
  );

  if (allChecked.length === 0) {
    console.warn('チェック済みが見つかりませんでした。画面を一度スクロールしてから再実行してみてください。');
  }

  // 2) 上部のオプション（画像/Files/改行 など）を除外
  // 置き換え後（安全版）
  const isHeaderOption = (name) => {
    const s = (name || '').trim();
    return (
      // 日本語UI（先頭一致）
      /^(画像|Salesforce\s*Files|改行)/.test(s) ||
      // 英語UI（先頭一致のみ・語句を限定）
      /^(Include images|Salesforce\s*Files|Replace line breaks)/i.test(s)
    );
  };

  // 3) ラベル解決ロジック
  const getLabelText = ({ cb, d }) => {
    const txt = s => (s || '').replace(/\s+/g, ' ').trim();

    // 3-1) label[for] で結び付くラベル
    if (cb.id) {
      const lbl = d.querySelector(`label[for="${CSS.escape(cb.id)}"]`);
      if (lbl && txt(lbl.textContent)) return txt(lbl.textContent);
    }

    // 3-2) aria-label / aria-labelledby
    const aria = cb.getAttribute('aria-label');
    if (aria && aria.trim()) return txt(aria);
    const labelled = cb.getAttribute('aria-labelledby');
    if (labelled) {
      const joined = labelled.split(/\s+/).map(id => {
        const el = d.getElementById(id);
        return el ? txt(el.textContent) : '';
      }).filter(Boolean).join(' ');
      if (joined) return joined;
    }

    // 3-3) 同一行の次セル（Classic典型: <tr><td>[cb]</td><td>ObjectName</td>…）
    const tr = cb.closest('tr');
    if (tr) {
      const tds = Array.from(tr.querySelectorAll('td'));
      const idx = tds.findIndex(td => td.contains(cb));
      if (idx >= 0 && idx < tds.length - 1) {
        const t = txt(tds[idx + 1].innerText || tds[idx + 1].textContent);
        if (t) return t;
      }
    }

    // 3-4) 近傍テキスト（親→隣要素→テキスト）
    let n = cb;
    for (let i = 0; i < 5 && n; i++) {
      const sib = n.nextElementSibling;
      if (sib && txt(sib.innerText || sib.textContent)) return txt(sib.innerText || sib.textContent);
      n = n.parentElement;
    }

    return '';
  };

  // 4) 抽出・整形
  const raw = allChecked.map(getLabelText)
    .map(t => t.replace(/\s*（.*?）\s*$/,'').trim()) // （注釈）除去
    .filter(Boolean)
    .filter(t => !/^(すべて選択|全選択|Select All)$/i.test(t))
    .filter(t => !isHeaderOption(t));

  const names = [...new Set(raw)].sort(new Intl.Collator('ja').compare);

  // 5) 出力
  console.clear();
  console.table(names.map((n,i)=>({ No: i+1, Object: n })));
  console.log(`✅ チェック対象: ${names.length}件`);

  const text = names.join('\n');
  const csv  = 'No,Object\n' + names.map((n,i)=>`${i+1},"${n.replace(/"/g,'""')}"`).join('\n');

  const downloadCsv = () => {
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const ts   = new Date().toISOString().replace(/[-:T]/g,'').slice(0,14);
    a.href = url; a.download = `CheckedObjects_${ts}.csv`;
    (document.body || document.documentElement).appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
    console.warn('📥 クリップボード不可のためCSVをダウンロードしました。');
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => console.log('📋 クリップボードにコピーしました。'))
      .catch(() => downloadCsv());
  } else {
    downloadCsv();
  }
})();
