create table person (
	id serial primary key,
	first_name text,
	last_name text
);

create table post (
	id serial primary key,
	person_id int not null references person,
	title text not null,
	excerpt text not null,
	body text not null
);


insert into person (first_name, last_name) values
('Darth', 'Vader'),
('Luke', 'Skywalker'),
('Leia', 'Organa'),
('R2', 'D2'),
('Admiral', 'Ackbar');


insert into post (person_id, title, excerpt, body) values
(1, $_$Join me, and together we'll rule the galaxy as father and son.$_$,
	$_$And what of the Rebellion? If the Rebels have obtained a complete technical readout of this station, it is possible, however unlikely, that they might find a weakness and exploit it. The plans you refer to will soon be back in our hands. Any attack made by the Rebels against this station would be a useless gesture, no matter what technical data they've obtained. This station is now the ultimate power in the universe. I suggest we use it!$_$,
	$_$It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).$_$),
(1, 'You can never know the power of the dark side',
	$_$Hey, whoa, just where do you think you're going? Master Luke here is your rightful owner. We'll have no more of this Obi-Wan Kenobi jibberish...and don't talk to me about your mission, either. You're fortunate he doesn't blast you into a million pieces right here. What's wrong with him now? Oh my...sir, he says there are several creatures approaching from the southeast. Sandpeople! Or worst! Come on, let's have a look. Come on. There are two Banthas down there but I don't see any...wait a second, they're Sandpeople all right. I can see one of them now.$_$,
	$_$It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).$_$),
(2, 'Power Converters',
	$_$They must be delivered safely or other star systems will suffer the same fate as Alderaan. Your destiny lies along a different path than mine. The Force will be with you...always! Boy you said it, Chewie. Where did you dig up that old fossil? Ben is a great man. Yeah, great at getting us into trouble. I didn't hear you give any ideas... Well, anything would be better than just hanging around waiting for him to pick us up... Who do you think...$_$,
	$_$It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).$_$),
(2, $_$I'm a Jedi, like my father before me$_$,
	$_$How long before you can make the jump to light speed? It'll take a few moments to get the coordinates from the navi-computer. Are you kidding? At the rate they're gaining... Traveling through hyperspace isn't like dusting crops, boy! Without precise calculations we could fly right through a star or bounce too close to a supernova and that'd end your trip real quick, wouldn't it? What's that flashing? We're losing our deflector shield. Go strap yourself in, I'm going to make the jump to light speed.$_$,
	$_$It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).$_$),
(3, $_$You're short for a stormtrooper$_$,
	$_$He says the restraining bolt has short circuited his recording system. He suggests that if you remove the bolt, he might be able to play back the entire recording. H'm? Oh, yeah, well, I guess you're too small to run away on me if I take this off! Okay. There you go. Well, wait a minute. Where'd she go? Bring her back! Play back the entire message. What message? The one you're carrying inside your rusty innards! Luke? Luke! Come to dinner! All right, I'll be right there, Aunt Beru. I'm sorry, sir, but he appears to have picked up a slight flutter. Well, see what you can do with him. I'll be right back. Just you reconsider playing that message for him. No, I don't think he likes you at all. No, I don't like you either.$_$,
	$_$It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).$_$),
(4, $_$It's a trap!!$_$,
	$_$Hey, whoa, just where do you think you're going? Master Luke here is your rightful owner. We'll have no more of this Obi-Wan Kenobi jibberish...and don't talk to me about your mission, either. You're fortunate he doesn't blast you into a million pieces right here. What's wrong with him now? Oh my...sir, he says there are several creatures approaching from the southeast. Sandpeople! Or worst! Come on, let's have a look. Come on. There are two Banthas down there but I don't see any...wait a second, they're Sandpeople all right. I can see one of them now.$_$,
	$_$It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).$_$);
