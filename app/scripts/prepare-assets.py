"""Produce reviewed copies from preserved art; run with Codex's bundled Pillow runtime."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import hashlib,json
root=Path(__file__).resolve().parents[2]
out=root/'app/assets'; out.mkdir(exist_ok=True)
records=[]
def produce(source,name,crop=None,size=None,cell=None):
    path=root/source
    with Image.open(path) as original:
        im=original.copy()
        if crop: im=im.crop(crop)
        if cell:
            im=im.convert('RGBA')
            # Ignore barely visible generator alpha when measuring the subject bounds.
            bounds=im.getchannel('A').point(lambda a: 255 if a>35 else 0).getbbox()
            if bounds: im=im.crop(bounds)
            im=ImageOps.contain(im,(cell[0]-8,cell[1]-8),Image.Resampling.LANCZOS)
            canvas=Image.new('RGBA',cell,(0,0,0,0))
            canvas.alpha_composite(im,((cell[0]-im.width)//2,(cell[1]-im.height)//2))
            im=canvas
        elif size: im.thumbnail(size,Image.Resampling.LANCZOS)
        if name.endswith('.jpg'): im.convert('RGB').save(out/name,quality=90,optimize=True)
        else: im.save(out/name,optimize=True)
        records.append({'file':name,'source':source,'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'crop':crop,'width':im.width,'height':im.height,'sha256':hashlib.sha256((out/name).read_bytes()).hexdigest()})
scenes={'title':(17,(0,235,1024,965)),'travel':(8,(0,340,1024,940)),'departure':(5,None),'rest-stop':(11,None),'motel':(12,None),'landmark':(18,None),'crypto':(10,None),'food-carts':(1,None),'victory':(16,(0,175,1024,1024)),'loss':(4,(0,180,1024,865)),'breakdown':(0,(0,340,1024,1024)),'doomscrolling':(13,(0,160,1024,1024)),'illness':(3,None),'free-box':(15,(0,125,1024,1024)),'wifi':(2,(0,105,1024,930)),'nft':(14,None)}
for name,(number,crop) in scenes.items(): produce(f'images/the_portland_trail_{number:05}.jpg',name+'.jpg',crop=crop,size=(1024,1024))
portraits={'influencer':(20,0,731,577),'dev':(732,0,1374,577),'prepper':(25,580,682,1145),'barista':(704,580,1374,1145)}
for name,box in portraits.items(): produce('docs/handoff/graphics-v1/background-portraits-master.png','portrait-'+name+'.png',box,cell=(128,128))
icons={'money':(25,85,453,462),'food':(470,30,870,460),'fuel':(908,35,1307,463),'ammo':(1320,94,1774,464),'parts':(24,470,474,880),'kombucha':(542,460,791,887),'nft':(869,513,1306,887)}
for name,box in icons.items(): produce('docs/handoff/graphics-v1/resource-icons-master.png','resource-'+name+'.png',box,cell=(64,64))
produce('docs/handoff/graphics-v1/van-side-master.png','van.png',cell=(256,128))
(out/'manifest.json').write_text(json.dumps({'version':1,'note':'Reviewed static scene copies and extracted concepts. Not animation or strict fixed-grid pixel art. Originals unchanged.','assets':records},indent=2)+'\n')
sheet=Image.new('RGB',(800,430),'#07110a'); draw=ImageDraw.Draw(sheet)
for i,name in enumerate(portraits):
    im=Image.open(out/f'portrait-{name}.png');sheet.paste(im,(20+i*190,10),im);draw.text((20+i*190,145),name,fill='#e1eacb')
for i,name in enumerate(icons):
    im=Image.open(out/f'resource-{name}.png');sheet.paste(im,(15+i*110,190),im)
    small=im.resize((32,32),Image.Resampling.LANCZOS);sheet.paste(small,(30+i*110,275),small);draw.text((15+i*110,325),name,fill='#e1eacb')
sheet.save('/private/tmp/portland-assets-preview.png')
print('Prepared',len(records),'assets with source hashes and production rectangles.')
