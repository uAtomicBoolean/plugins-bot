import {
	REST,
	Routes,
	Client,
	ClientOptions,
	Collection,
	ApplicationCommandDataResolvable } from 'discord.js';
import { discordId, commandsArray } from '@lib/types';
import { green, red, yellow } from 'ansicolor';
import fs from 'fs';


const LOG_LEVELS = ['INFO', 'WARNING', 'ERROR'];

// This variable is necessary to load the plugins from dist and
// not src (and the opposite) when running the code after compilation.
const PLUGINS_PATH = `${__dirname}/../plugins`;


export class Bot extends Client {
	public commands: commandsArray;

	constructor(options: ClientOptions) {
		super(options);
		this.commands = new Collection();

		this.loadPlugins();
	}

	/**
	 * Start the bot and log the start.
	 * @param token The bot's token.
	 */
	async start(token: string) {
		this.log('Bot starting up.');
		await super.login(token);
	}

	/* ----------------------------------------------- */
	/* LOGGING                                         */
	/* ----------------------------------------------- */
	/**
	 * Get the colored text for the log's level.
	 * @param level The log's level.
	 * @returns A colored string.
	 */
	_getLevelTxt(level: number): string {
		switch (level) {
		case 0:
			return green(LOG_LEVELS[level]);
		case 1:
			return yellow(LOG_LEVELS[level]);
		case 2:
			return red(LOG_LEVELS[level]);
		default:
			return 'UNKNOWN';
		}
	}

	/**
	 * Display a log.
	 * @param text The log message.
	 * @param level The log level.
	 */
	log(text: string, level: number = 0) {
		const date = new Date();
		const dateFormat = `${date.getFullYear()}-${date.getMonth()}-${date.getDay()} `
			+ `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
		console.log(`${dateFormat} ${this._getLevelTxt(level)} : ${text}`);
	}

	/**
	 * Display a log but specificaly for an error in a command.
	 * @param cmd_name The command's name.
	 * @param error The error.
	 */
	logErrCommande(cmd_name: string, error: unknown) {
		this.log(`An error occured in the "${cmd_name}" command !`, 2);
        	console.log(error);
	}

	/* ----------------------------------------------- */
	/* PLUGINS                                         */
	/* ----------------------------------------------- */
	/**
	 * Load the plugins in the bot.
	 */
	loadPlugins() {
		const plugins = fs.readdirSync(PLUGINS_PATH, { withFileTypes: true })
			.filter(dirent => dirent.isDirectory())
			.map(dirent => dirent.name);

		this.log(`${plugins.length} plugins found !`);
		let nb_plugins_charges = 0;

		for (const plugin of plugins) {
			this.log(`Loading the plugin '${plugin}'.`);

			const folders = fs.readdirSync(`${PLUGINS_PATH}/${plugin}`, { withFileTypes: true })
				.filter(dirent => dirent.isDirectory() || dirent.name === 'init.ts')
				.map(dirent => dirent.name);

			if (folders.includes('init.ts')) {
				const plug_conf = require(`${PLUGINS_PATH}/${plugin}/init.ts`);
				if ('enabled' in plug_conf && !plug_conf.enabled) {
					this.log('Plugin ignored as it is disabled (init.ts) !', 1);
					continue;
				}
				if ('init' in plug_conf) {
					plug_conf.init(this);
				}
			}

			if (folders.includes('commands')) { this.loadCommands(plugin); }
			if (folders.includes('events')) { this.loadEvents(plugin); }
			nb_plugins_charges++;
		}

		this.log(`${nb_plugins_charges} plugins loaded !`);
	}

	/**
	 * Load a plugin's commands in the bot.
	 * @param plugin The plugin's name.
	 */
	loadCommands(plugin: string) {
		const commandsPath = `${PLUGINS_PATH}/${plugin}/commands`;
		// Removing the '.map' files from the resulting list to avoid a runtime error.
		// The map files are used by the Typescript debugger.
		const commands = fs.readdirSync(commandsPath, { withFileTypes: true })
			.filter(filent => filent.isFile() && !filent.name.endsWith('.map'))
			.map(filent => filent.name);

		for (const command of commands) {
			this.log(`\t command: ${command}`);
			const data = require(`${commandsPath}/${command}`);
			this.commands.set(data.command.name, data);
		}
	}

	/**
	 * Load a plugin's events in the bot.
	 * @param plugin The plugin's name.
	 */
	loadEvents(plugin: string) {
		const eventsPath = `${PLUGINS_PATH}/${plugin}/events`;
		const events = fs.readdirSync(eventsPath, { withFileTypes: true })
			.filter(filent => filent.isFile() && !filent.name.endsWith('.map'))
			.map(filent => filent.name);

		for (const event of events) {
			this.log(`\t event: ${event}`);

			const data = require(`${eventsPath}/${event}`);
			const data_exc = async (...args: any[]) => { await data.execute(...args, this); };

			if (data.once) {
				this.once(data.name, data_exc);
			}
			else {
				this.on(data.name, data_exc);
			}
		}
	}

	/**
	 * Upload the commands to either a specific guild or all the guilds.
	 * @param targetGuildId The guild's id to upload the commands to.
	 */
	async uploadCommands(targetGuildId?: discordId) {
		this.log('The commands will be refreshed in ' + (targetGuildId
			? `the guild '${targetGuildId}'.`
			: 'all the guilds.'
		));

		const commands: ApplicationCommandDataResolvable[] = [];
		this.commands.map(data => {
			commands.push(data.command.toJSON());
			this.log(`Loading the commmand: ${data.command.toJSON().name}`);
		});

		const rest = new REST({ version: '10' }).setToken(this.token);

		this.log(`Started refreshing ${this.commands.size} application (/) commands!`);
		try {
			await rest.put(
				Routes.applicationGuildCommands(this.user.id, targetGuildId),
				{ body: commands },
			);

			this.log(`Finished refreshing ${this.commands.size} application (/) commands!`);
		}
		catch (error) {
			this.log('An error occured while refreshing the application (/) commands!', 2);
			console.error(error);
		}
	}
}
