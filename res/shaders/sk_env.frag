#version 120

uniform sampler2D BaseMap;
uniform sampler2D NormalMap;
uniform sampler2D LightMask;
uniform sampler2D BacklightMap;
uniform sampler2D EnvironmentMap;
uniform samplerCube CubeMap;

uniform vec3 specColor;
uniform float specStrength;
uniform float specGlossiness;

uniform vec3 glowColor;
uniform float glowMult;

uniform vec2 uvScale;
uniform vec2 uvOffset;

uniform bool hasEmit;
uniform bool hasSoftlight;
uniform bool hasBacklight;
uniform bool hasRimlight;

uniform float lightingEffect1;
uniform float lightingEffect2;

uniform float useEnvMask;
uniform float envReflection;

uniform mat4 worldMatrix;

varying vec3 LightDir;
varying vec3 ViewDir;

varying vec4 A;
varying vec4 C;
varying vec4 D;

varying vec3 N;
varying vec3 t;
varying vec3 b;


vec3 tonemap(vec3 x)
{
	float _A = 0.15;
	float _B = 0.50;
	float _C = 0.10;
	float _D = 0.20;
	float _E = 0.02;
	float _F = 0.30;

	return ((x*(_A*x+_C*_B)+_D*_E)/(x*(_A*x+_B)+_D*_F))-_E/_F;
}

vec3 toGrayscale(vec3 color)
{
	return vec3(dot(vec3(0.3, 0.59, 0.11), color));
}

void main( void )
{
	vec2 offset = gl_TexCoord[0].st * uvScale + uvOffset;

	vec4 baseMap = texture2D( BaseMap, offset );
	vec4 normalMap = texture2D( NormalMap, offset );
	
	vec3 normal = normalize(normalMap.rgb * 2.0 - 1.0);
	
	
	vec3 L = normalize(LightDir);
	vec3 E = normalize(ViewDir);
	vec3 R = reflect(-L, normal);
	vec3 H = normalize( L + E );
	
	float NdotL = max( dot(normal, L), 0.0 );
	float NdotH = max( dot(normal, H), 0.0 );
	float EdotN = max( dot(normal, E), 0.0 );
	float NdotNegL = max( dot(normal, -L), 0.0 );
	float facing = max( dot(-L, E), 0.0 );

	vec3 reflected = reflect( -E, normal );
	vec3 reflectedVS = b * reflected.x + t * reflected.y + N * reflected.z;
	vec3 reflectedWS = vec3( worldMatrix * (gl_ModelViewMatrixInverse * vec4( reflectedVS, 0.0 )) );


	vec4 env = texture2D( EnvironmentMap, offset );
	vec4 cube = textureCube( CubeMap, reflectedWS );
	cube.rgb *= envReflection * mix( normalMap.a, env.r, useEnvMask );


	vec4 color;
	vec3 albedo = baseMap.rgb * C.rgb;
	vec3 diffuse = A.rgb + (D.rgb * NdotL);

	// Environment
	albedo += cube.rgb;
	
	// Emissive
	vec3 emissive;
	if ( hasEmit ) {
		emissive += glowColor * glowMult;
	}

	// Specular
	vec3 spec = specColor * specStrength * normalMap.a * pow(NdotH, specGlossiness);
	spec *= D.rgb;

	vec3 backlight;
	if ( hasBacklight ) {
		backlight = texture2D( BacklightMap, offset ).rgb;
		backlight *= NdotNegL;
		
		emissive += backlight * D.rgb;
	}

	vec4 mask;
	if ( hasRimlight || hasSoftlight ) {
		mask = texture2D( LightMask, offset );
	}

	vec3 rim;
	if ( hasRimlight ) {
		rim = vec3((1.0 - NdotL) * (1.0 - EdotN));
		rim = mask.rgb * pow(rim, vec3(lightingEffect2)) * D.rgb * vec3(0.66);
		rim *= smoothstep( -0.5, 1.0, facing );
		
		emissive += rim;
	}
	
	vec3 soft;
	if ( hasSoftlight ) {
		float wrap = (dot(normal, L) + lightingEffect1) / (1.0 + lightingEffect1);

		soft = max( wrap, 0.0 ) * mask.rgb * smoothstep( 1.0, 0.0, NdotL );
		soft *= sqrt( clamp( lightingEffect1, 0.0, 1.0 ) );
		
		emissive += soft * D.rgb;
	}

	color.rgb = albedo * (diffuse + emissive) + spec;
	color.rgb = tonemap( color.rgb ) / tonemap( vec3(1.0) );
	color.a = C.a * baseMap.a;

	gl_FragColor = color;
}
