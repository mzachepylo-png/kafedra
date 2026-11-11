// Тема 12. Біохімічні маркери: пероксидаза (ЛР 51), ізоферменти в ПААГ (ЛР 52), поліфенолоксидаза (ЛР 53).
import { tabs } from './t12-ui.js';
import { SpectroModel, CFG } from './t12-spectro.js';
import { PageModel } from './t12-page.js';

const root = document.getElementById('t12-models');
if (root) {
  tabs(root);
  const m51 = document.getElementById('m51'), m52 = document.getElementById('m52'), m53 = document.getElementById('m53');
  if (m51) new SpectroModel(m51, CFG.pox);
  if (m52) new PageModel(m52);
  if (m53) new SpectroModel(m53, CFG.ppo);
}
