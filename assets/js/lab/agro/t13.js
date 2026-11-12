// Тема 13. Кріозбереження: програмне заморожування (загальна теорія), ЛР 54 (клітини буряка), ЛР 55 (білки соку).
import { tabs } from './t13-ui.js';
import { FreezeModel } from './t13-freeze.js';
import { TubesModel, CFGS } from './t13-tubes.js';

const root = document.getElementById('t13-models');
if (root) {
  tabs(root);
  const a = document.getElementById('m-cryo'), b = document.getElementById('m54'), c = document.getElementById('m55');
  if (a) new FreezeModel(a);
  if (b) new TubesModel(b, CFGS.beet);
  if (c) new TubesModel(c, CFGS.sap);
}
