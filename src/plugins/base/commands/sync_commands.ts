import { Bot } from '@lib/bot';
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';


/* ----------------------------------------------- */
/* COMMAND BUILD                                   */
/* ----------------------------------------------- */
export const data = new SlashCommandBuilder()
	.setName('sync_commands')
	.setDescription('Upload or refresh the commands to all the guilds.')
	.setDMPermission(false)
	.setDefaultMemberPermissions(8192);


/* ----------------------------------------------- */
/* FUNCTIONS                                       */
/* ----------------------------------------------- */
/**
 * The command's handler.
 * @param inter The interaction generated by the command.
 * @param client The bot's client.
 */
export async function execute(inter: CommandInteraction, client: Bot) {
	let isInteractionUnknown = false;
	await inter.deferReply({ ephemeral: true }).catch(() => {
		client.log('Interaction not found! (sync_commands:deferReply)', 2);
		isInteractionUnknown = true;
	});

	if (isInteractionUnknown) return;

	client.log('Executing the command "sync_commands".', 1);
	await client.uploadCommands();

	return inter.editReply({ content: 'Commands updated.' })
		.catch(error => client.logErrCommande('sync_commands', error));
}