import { CAMERA_CYCLE, ensureHanLength, STYLE_PREFIX } from './prompts.ts';

export interface TemplateShot {
  narrationText: string;
  imagePrompt: string;
  cameraMotion: (typeof CAMERA_CYCLE)[number];
}

export interface StoryTemplate {
  id: 'lighthouse' | 'cabin';
  title: string;
  summary: string;
  narration: string;
  protagonist: string;
  shots: TemplateShot[];
}

const lighthouseNarration = ensureHanLength([
  '海边的灯塔今晚很安静。小橘猫南瓜趴在顶层的厚毯子上，听细雨一下一下落在玻璃上。',
  '灯是暖的，把小房间照成浅浅的橘色。南瓜把下巴搁在前爪上，看雨丝从窗前慢慢滑下去。',
  '它没有出门。毯子又软又干，鼻尖只闻到羊毛，还有一点点远处的海风。',
  '雨声不急，像有人在很远的地方轻轻翻着书页。南瓜的耳朵跟着雨点动了动，随后又慢慢垂下来。',
  '灯塔的灯光在窗外转了一圈，一道柔和的光从墙上走过，然后离开了。',
  '南瓜眯起眼睛，把身体缩成一个圆，尾巴盖住鼻子。细雨还在下，听起来却更远了。',
  '屋里只有暖灯和毯子。南瓜的呼吸变得又慢又稳，爪子渐渐松开。',
  '窗外仍是细雨和安静的海。它在这个不慌不忙的顶层，安心地睡着了。',
].join(''));

const cabinNarration = ensureHanLength([
  '森林小屋里点着一盏小灯。小兔子把热牛奶放在手心边，看杯口慢慢冒出浅浅的白气。',
  '窗外的叶子几乎不动。屋里有木头的味道，毯子搭在椅子上，软软的。',
  '小兔子喝了一小口，牛奶是温的，不烫。它把杯子放回桌上，耳朵放松下来。',
  '夜风偶尔碰一碰窗框，声音很轻。小兔子把脚缩进毯子，看着灯火稳稳地亮着。',
  '它没有再往外看。今天的路已经走完了，明天的事可以明天再说。',
  '呼吸慢慢变长。热牛奶的味道淡了，灯光也显得更柔和。',
  '小兔子把脑袋靠上枕边，眼睛一点一点合上。森林安静地围着小屋。',
  '它在这杯温牛奶和这盏小灯旁边，安心地睡着了。',
].join(''));

function shotsFor(narration: string, protagonist: string, style: string): TemplateShot[] {
  const chars = [...narration];
  const size = Math.ceil(chars.length / 6);
  return CAMERA_CYCLE.slice(0, 6).map((cameraMotion, index) => {
    const narrationText = chars.slice(index * size, (index + 1) * size).join('').trim() || '夜色很安静。';
    const prefix = STYLE_PREFIX[style] ?? STYLE_PREFIX.watercolor;
    return {
      narrationText,
      cameraMotion,
      imagePrompt: `${prefix}, same character in every shot: ${protagonist}, consistent face, clothes and colors, calm night, no text`,
    };
  });
}

export function templateByTheme(theme: string): StoryTemplate {
  const useCabin = !/灯塔|猫/.test(theme);
  const narration = useCabin ? cabinNarration : lighthouseNarration;
  const protagonist = useCabin ? 'a small rabbit in a soft sweater' : 'a small orange cat named pumpkin';
  const title = useCabin ? '小屋里的热牛奶' : '灯塔里的雨声';
  const summary = useCabin ? '小兔子在森林小屋里喝完热牛奶，慢慢睡着了。' : '小橘猫南瓜在灯塔顶层听着细雨，慢慢睡着了。';
  return {
    id: useCabin ? 'cabin' : 'lighthouse',
    title,
    summary,
    narration,
    protagonist,
    shots: shotsFor(narration, protagonist, 'watercolor'),
  };
}

export function lighthouseTemplate(): StoryTemplate {
  return templateByTheme('灯塔里的猫');
}
