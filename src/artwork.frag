precision highp float;
varying vec2 vUv;
uniform vec2 uSize;
uniform float uView;
uniform float uPiece;
uniform float uDpr;
uniform float uFullscreen;

float sceneScale() {
  float aspect = uSize.x/uSize.y;
  if (uFullscreen>.5 && uPiece<.5) return aspect>=1.0 ? 5.05 : 3.76/aspect;
  if (uFullscreen>.5) return aspect>=1.0 ? 3.27 : 3.12/aspect;
  return aspect<.95 ? max(5.6,3.65/aspect) : max(4.6,4.75/aspect);
}
vec2 gridCounts(vec2 spacing) {
  if (uFullscreen>.5) return ceil(vec2(uSize.x/uSize.y,1.0)*sceneScale()/spacing);
  return uSize.x/uSize.y<.95 ? vec2(3.0,4.0) : vec2(4.0,3.0);
}

float hash(vec2 point) { return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453); }
float roundedBox(vec2 point, vec2 halfSize, float radius) { vec2 edge = abs(point) - halfSize + radius; return min(max(edge.x, edge.y), 0.0) + length(max(edge, 0.0)) - radius; }
float mask(float distance) { float edge = clamp(fwidth(distance), .00001, .015); return 1.0 - smoothstep(-edge, edge, distance); }
float chamberMask(float distance) { float edge = clamp(fwidth(distance)*(uFullscreen>.5 ? .5 : 1.0), .00001, .015); return 1.0-smoothstep(-edge,edge,distance); }
vec3 ink(float index) {
  float hue = mod(floor(index), 6.0);
  if (hue < 1.0) return vec3(.87,.21,.105);
  if (hue < 2.0) return vec3(.96,.64,.075);
  if (hue < 3.0) return vec3(.23,.49,.33);
  if (hue < 4.0) return vec3(.09,.40,.57);
  if (hue < 5.0) return vec3(.13,.21,.39);
  return vec3(.08,.11,.10);
}
vec3 chamber(vec2 point, vec3 paper, float angle) {
  vec2 spacing = uFullscreen>.5 ? vec2(.94,1.01) : vec2(1.04,1.09);
  vec2 counts = gridCounts(spacing);
  vec2 origin = counts * spacing * .5;
  vec2 cell = floor((point + origin) / spacing);
  if (cell.x < 0.0 || cell.x >= counts.x || cell.y < 0.0 || cell.y >= counts.y) return paper;
  vec2 local = mod(point + origin, spacing) - spacing*.5;
  float shape = roundedBox(local, vec2(.35,.43), .29);
  float contact = roundedBox(local-vec2(.009,-.018),vec2(.35,.43),.29);
  paper *= 1.0-exp(-max(contact,0.0)*(uFullscreen>.5 ? 100.0 : 65.0))*(uFullscreen>.5 ? .18 : .23);
  float identity = cell.x + cell.y*counts.x;
  vec3 interior = vec3(.024,.037,.038);
  float groovePhase = (local.x + angle*.15)*420.0;
  float grooveVisibility = 1.0-smoothstep(1.0,3.14159,fwidth(groovePhase));
  float stripe = sin(groovePhase)*.5+.5;
  vec2 corner = abs(local)-vec2(.06,.14);
  vec2 edgeNormal = max(corner,0.0)*sign(local);
  if(dot(edgeNormal,edgeNormal)<.000001) edgeNormal = corner.x>corner.y ? vec2(sign(local.x),0.0) : vec2(0.0,sign(local.y));
  edgeNormal = normalize(edgeNormal);
  float wall = exp(-max(-shape,0.0)*26.0);
  float wallLight = .22+.78*max(dot(edgeNormal,normalize(vec2(-.6,.8))),0.0);
  interior += vec3(.14,.18,.17)*wall*wallLight;
  interior += vec3(.035,.05,.05)*pow(max(0.0,1.0-length((local-vec2(-.16-angle*.035,.17))*vec2(2.4,1.3))),3.0);
  vec2 centre = vec2(angle*.16, sin(angle*2.2+identity*.73)*.23);
  vec2 sphere = (local-centre)*vec2(1.05,1.20);
  float distance = length(sphere);
  float radius = .25 + sin(identity)*.012;
  float disk = chamberMask(distance-radius);
  float facing = angle*1.3+identity*.72;
  float colourIndex = floor(facing+6.0);
  float change = smoothstep(.25,.75,fract(facing+6.0));
  vec3 pigment = mix(ink(mod(colourIndex,5.0)),ink(mod(colourIndex+1.0,5.0)),change);
  pigment = mix(pigment,sqrt(pigment),.10);
  vec2 surface = sphere/radius;
  vec3 normal = normalize(vec3(surface,sqrt(max(.0001,1.0-dot(surface,surface)))));
  vec3 viewDirection = normalize(vec3(angle*.48,.06,1.0));
  vec3 lightDirection = normalize(vec3(-.55,.72,1.0));
  vec3 halfDirection = normalize(lightDirection+viewDirection);
  float diffuse = max(dot(normal,lightDirection),0.0);
  float facingView = max(dot(normal,viewDirection),0.0);
  float fresnel = .045+.45*pow(1.0-facingView,5.0);
  float gloss = pow(max(dot(normal,halfDirection),0.0),90.0);
  float softbox = pow(max(dot(normal,halfDirection),0.0),14.0);
  vec3 colour = pigment*(.25+.67*diffuse+.15*normal.z);
  colour += vec3(.90,.96,1.0)*(gloss*.83+softbox*.12);
  colour += mix(pigment,vec3(.72,.84,.86),.45)*fresnel*.48;
  float castShadow = length((local-centre-vec2(.018,-.035))*vec2(1.05,1.20))-radius;
  interior *= 1.0-exp(-max(castShadow,0.0)*(uFullscreen>.5 ? 85.0 : 58.0))*.60;
  float rim = chamberMask(abs(distance-radius-.018)-.003);
  interior = mix(interior,pigment*(.15+.23*max(normal.y,0.0)),rim*(1.0-disk));
  interior = mix(interior,colour,disk);
  interior *= 1.0-(uFullscreen>.5 ? .01 : .018)*stripe*grooveVisibility;
  float bevel = chamberMask(abs(shape+.008)-.003);
  interior += vec3(.19,.23,.22)*bevel*wallLight;
  return mix(paper,interior,chamberMask(shape));
}
vec3 ribbon(vec2 point, vec3 paper, float angle) {
  vec2 halfSize = uSize.x / uSize.y < .95 ? vec2(1.45,2.04) : vec2(2.0,1.52);
  float shape = roundedBox(point,halfSize,.025);
  if(uFullscreen<.5 && shape>.08) return paper;
  paper *= 1.0-exp(-max(shape,0.0)*55.0)*.14;
  float groovePhase = gl_FragCoord.x/(uDpr*3.0)*6.28318;
  float grooveVisibility = 1.0-smoothstep(1.0,3.14159,fwidth(groovePhase));
  float lenticule = sin(groovePhase)*.5+.5;
  float localAngle = angle;
  vec2 warp = point;
  warp.x += sin(point.y*1.85+localAngle*1.25)*(.50+localAngle*.12);
  warp.y += sin(point.x*1.2-localAngle)*.1;
  float phase = (warp.x*.8+warp.y*.65 + localAngle*.9)*2.5+8.0;
  float band = floor(phase);
  float boundaryWidth = max(fwidth(phase)*.5,.00001);
  float positionInBand = fract(phase);
  vec3 pigment = mix(ink(band-1.0),ink(band),smoothstep(-boundaryWidth,boundaryWidth,positionInBand));
  pigment = mix(pigment,ink(band+1.0),smoothstep(1.0-boundaryWidth,1.0+boundaryWidth,positionInBand));
  pigment *= .84 + .16*sin(fract(phase)*3.14159);
  pigment *= 1.0-.025*lenticule*grooveVisibility;
  return uFullscreen>.5 ? pigment : mix(paper,pigment,mask(shape));
}
vec3 orbit(vec2 point, vec3 paper, float angle) {
  vec2 spacing = vec2(1.00,1.02);
  vec2 counts = gridCounts(spacing);
  vec2 origin = counts * spacing * .5;
  vec2 cell = floor((point+origin)/spacing);
  if(cell.x<0.0||cell.x>=counts.x||cell.y<0.0||cell.y>=counts.y) return paper;
  vec2 local = mod(point+origin,spacing)-spacing*.5;
  float identity = cell.x+cell.y*counts.x;
  float rotation = identity*.56+angle*1.7;
  mat2 turning = mat2(cos(rotation),-sin(rotation),sin(rotation),cos(rotation));
  vec2 offset = turning*vec2(.15*angle,.11);
  float first = length(local-offset)-.31;
  float second = length(local+offset)-.31;
  vec3 front = ink(identity+1.0);
  vec3 back = ink(identity+3.0);
  float firstMask=mask(first);
  float secondMask=mask(second);
  float edgeFade = smoothstep(0.0,.05,min(spacing.x*.5-abs(local.x),spacing.y*.5-abs(local.y)));
  paper*=1.0-exp(-max(min(first,second),0.0)*48.0)*.12*edgeFade;
  vec3 pigment=mix(paper,front,firstMask);
  pigment=mix(pigment,back,secondMask);
  pigment=mix(pigment,front*back*.85,firstMask*secondMask);
  pigment+=max(0.0,1.0-length(local-vec2(-.12,.15))*2.1)*.06*max(firstMask,secondMask);
  return mix(pigment,pigment*(.965+.035*cos(gl_FragCoord.x/uDpr*2.5+angle*3.0)),max(firstMask,secondMask));
}
float studyBoundary(vec2 point) {
  if(uFullscreen>.5) return 1.0;
  vec2 halfSize=uSize.x/uSize.y<.95 ? vec2(1.46,2.07) : vec2(2.04,1.55);
  return mask(roundedBox(point,halfSize,.025));
}
float waveLine(float phase, float threshold) {
  float visibility=1.0-smoothstep(1.2,3.14159,fwidth(phase));
  float signal=sin(phase);
  float edge=max(fwidth(phase)*.5,.001);
  return mix(.5,smoothstep(threshold-edge,threshold+edge,signal),visibility);
}
vec3 interference(vec2 point, vec3 paper, float angle) {
  vec2 firstCentre=vec2(-.32-angle*.38,.12);
  vec2 secondCentre=vec2(.32+angle*.15,-.12+angle*.2);
  float firstPhase=length(point-firstCentre)*38.0;
  float secondPhase=length((point-secondCentre)*vec2(1.025,.975))*39.0;
  float firstLine=waveLine(firstPhase,.12);
  float secondLine=waveLine(secondPhase,.12);
  float beat=.5+.5*cos((firstPhase-secondPhase)*.85);
  vec3 pigment=mix(vec3(.90,.35,.20),vec3(.25,.66,.56),smoothstep(.22,.78,beat));
  vec3 background=mix(vec3(.91,.93,.87),pigment,.27+.25*beat);
  vec3 colour=mix(background,pigment*.48,(firstLine+secondLine)*.36);
  colour=mix(colour,vec3(.055,.115,.13),firstLine*secondLine*.86);
  float lens=.5+.5*cos(length(point)*1.7);
  colour*=.88+.12*lens;
  return mix(paper,colour,studyBoundary(point));
}
vec3 vortex(vec2 point, vec3 paper, float angle) {
  vec2 corridor=point-vec2(angle*.48,sin(angle*.9)*.18);
  float radius=max(length(corridor),.025);
  float depth=-log(radius);
  float turn=atan(corridor.y,corridor.x)+depth*.42+angle*.6;
  float segment=6.2831853/8.0;
  float facet=mod(turn+segment*.5,segment)-segment*.5;
  float polygonRadius=radius*cos(facet)/cos(segment*.5);
  float passage=-log(max(polygonRadius,.028))*4.5+angle*1.6;
  float ring=floor(passage);
  float across=fract(passage);
  float boundaryWidth=max(fwidth(passage),.001);
  float ridge=smoothstep(.0,boundaryWidth*1.4,across)*(1.0-smoothstep(1.0-boundaryWidth*1.4,1.0,across));
  float faceColour=.5+.5*cos(turn*4.0+ring*.81);
  float leftBlend=smoothstep(0.0,1.0,-angle);
  float rightBlend=smoothstep(0.0,1.0,angle);
  vec3 cool=mix(vec3(.11,.53,.59),vec3(.08,.57,.33),leftBlend);
  cool=mix(cool,vec3(.12,.32,.85),rightBlend);
  vec3 warm=mix(vec3(.92,.32,.12),vec3(.97,.63,.16),leftBlend);
  warm=mix(warm,vec3(.98,.29,.34),rightBlend);
  vec3 highlight=mix(vec3(.91,.77,.44),vec3(.98,.87,.58),leftBlend);
  highlight=mix(highlight,vec3(1.0,.69,.56),rightBlend);
  vec3 pigment=mix(cool,warm,smoothstep(.2,.8,faceColour));
  pigment=mix(pigment,highlight,pow(faceColour,7.0)*.75);
  float curvature=pow(sin(across*3.1415926),.7);
  float light=.34+.60*curvature+.14*cos(turn-1.8);
  vec3 colour=pigment*light;
  colour+=vec3(.70,.84,.85)*pow(max(0.0,cos(across*3.1415926-.8)),24.0)*.20;
  colour*=.46+.54*ridge;
  float distanceShade=smoothstep(.025,1.0,radius);
  colour=mix(vec3(.027,.044,.056),colour,.15+.85*distanceShade);
  return mix(paper,colour,studyBoundary(point));
}
vec3 fold(vec2 point, vec3 paper, float angle) {
  vec2 field=point*2.25;
  field.x+=sin(point.y*1.15+angle)*angle*.30;
  field.y+=angle*.35;
  vec2 lattice=vec2(1.0,1.7320508);
  vec2 first=mod(field,lattice)-lattice*.5;
  vec2 second=mod(field-lattice*.5,lattice)-lattice*.5;
  vec2 local=dot(first,first)<dot(second,second) ? first : second;
  vec2 identity=field-local;
  float seed=hash(floor(identity*vec2(2.0,2.0/1.7320508)+.5));
  float inversion=sin(angle*1.48+sin(identity.y*.65+identity.x*.5)*.22);
  float raised=.5+.5*inversion;
  float edge=max((fwidth(field.x)+fwidth(field.y))*.45,.0005);
  float topFace=smoothstep(-edge,edge,local.y-abs(local.x)/1.7320508);
  float rightFace=smoothstep(-edge,edge,local.x)*(1.0-topFace);
  float leftFace=1.0-topFace-rightFace;
  vec3 pigment=seed<.34 ? vec3(.88,.32,.22) : seed<.70 ? vec3(.35,.67,.57) : vec3(.92,.77,.49);
  vec3 top=mix(pigment*.24,mix(pigment,vec3(.98),.26),raised);
  vec3 left=mix(mix(pigment,vec3(.94),.08),pigment*.36,raised);
  vec3 right=mix(pigment*.57,pigment*.73,raised);
  vec3 colour=top*topFace+left*leftFace+right*rightFace;
  float hexEdge=.5-max(abs(local.x),abs(local.x)*.5+abs(local.y)*.8660254);
  float seam=smoothstep(.0,edge,hexEdge);
  colour=mix(vec3(.08,.14,.16),colour,seam);
  float bevel=exp(-max(hexEdge,0.0)*110.0)*.13;
  colour+=vec3(.81,.91,.86)*bevel*(.4+.6*raised);
  return mix(paper,colour,studyBoundary(point));
}
void main() {
  float aspect=uSize.x/uSize.y;
  float scale=sceneScale();
  vec2 point=(vUv-.5)*vec2(aspect,1.0)*scale;
  if (uFullscreen<.5) point.y-=.08;
  vec3 paper=vec3(.949,.953,.937);
  paper+=(hash(gl_FragCoord.xy)-.5)*.018;
  vec3 colour;
  if(uPiece<.5) colour=chamber(point,paper,uView);
  else if(uPiece<1.5) colour=fold(point,paper,uView);
  else if(uPiece<2.5) colour=ribbon(point,paper,uView);
  else if(uPiece<3.5) colour=orbit(point,paper,uView);
  else if(uPiece<4.5) colour=interference(point,paper,uView);
  else colour=vortex(point,paper,uView);
  gl_FragColor=vec4(colour,1.0);
}