import { Buffer } from "node:buffer";
import { ActionRowBuilder, ApplicationCommandOptionType, Message, SelectMenuComponentOptionData, StringSelectMenuBuilder, StringSelectMenuInteraction, TextBasedChannel } from "discord.js";
import { BaseCommand } from "../../structures/BaseCommand.js";
import { CommandContext } from "../../structures/CommandContext.js";
import { Command } from "../../utils/decorators/Command.js";
import { createEmbed } from "../../utils/functions/createEmbed.js";

@Command<typeof HelpCommand>({
    aliases: ["h", "command", "commands", "cmd", "cmds"],
    description: "Shows the command list or information for a specific command.",
    name: "help",
    slash: {
        options: [
            {
                type: ApplicationCommandOptionType.String,
                name: "command",
                description: "Command name to view a specific information about the command"
            }
        ]
    },
    usage: "{prefix}help [command]"
})
export class HelpCommand extends BaseCommand {
    private readonly listEmbed = createEmbed("info")
        .setAuthor({
            name: `${this.client.user?.username} - Command List`,
            iconURL: this.client.user?.displayAvatarURL()
        })
        .setFooter({
            text: `${this.client.config.prefix}help <command> to get more information for a specific command.`,
            iconURL: "https://cdn.stegripe.org/images/information.png"
        });

    private readonly infoEmbed = createEmbed("info")
        .setThumbnail("https://cdn.stegripe.org/images/question_mark.png");

    public async execute(ctx: CommandContext): Promise<Message | undefined> {
        if (ctx.isInteraction() && !ctx.deferred) await ctx.deferReply();
        this.infoEmbed.data.fields = [];
        const val = (ctx.args[0] as string | undefined) ??
            ctx.options?.getString("command") ??
            (
                ctx.additionalArgs.get("values") === undefined
                    ? null
                    : (ctx.additionalArgs.get("values") as string[])[0]
            );
        if (val === null) {
            const embed = this.listEmbed
                .setThumbnail("https://cdn.stegripe.org/images/icon.jpg");

            this.listEmbed.data.fields = [];
            for (const category of this.client.commands.categories.values()) {
                const isDev = this.client.config.devs.includes(ctx.author.id);
                const cmds = category.cmds.reduce<string[]>((pr, cu) => {
                    const cmd = this.client.commands.get(cu);
                    if (!isDev && (cmd?.meta.devOnly ?? false)) return pr;

                    return [...pr, `\`${cmd?.meta.name}\``];
                }, []);

                if (cmds.length === 0) continue;
                if (category.hide && !isDev) continue;

                embed.addFields({ name: `**${category.name}**`, value: cmds.join(", ") });
            }

            try {
                await ctx.send({ embeds: [embed] }, "editReply");
            } catch (error) {
                this.client.logger.error("PROMISE_ERR:", error);
            }

            return;
        }

        const command = this.client.commands.get(val) ??
            this.client.commands.get(this.client.commands.aliases.get(val) as unknown as string);

        if (!command) {
            const matching = this.generateSelectMenu(val, ctx.author.id);
            if (matching.length === 0) {
                await ctx.send({
                    embeds: [createEmbed("error", "Couldn't find any matching command name.", true)]
                }, "editReply");

                return;
            }

            await ctx.send({
                components: [
                    new ActionRowBuilder<StringSelectMenuBuilder>()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setMinValues(1)
                                .setMaxValues(1)
                                .setCustomId(
                                    Buffer.from(`${ctx.author.id}_${this.meta.name}`)
                                        .toString("base64")
                                )
                                .addOptions(matching)
                                .setPlaceholder("Please select the command")
                        )
                ],
                embeds: [createEmbed("error", "Couldn't find any matching command name, did you mean this?", true)]
            }, "editReply");

            return;
        }
        if (ctx.isSelectMenu()) {
            const matching = this.generateSelectMenu(val, ctx.author.id);
            if (matching.length === 0) {
                await ctx.send({
                    embeds: [createEmbed("error", "Couldn't find any matching command name.", true)]
                }, "editReply");

                return;
            }

            const channel = ctx.channel as unknown as TextBasedChannel;
            const msg = await channel.messages.fetch((ctx.context as StringSelectMenuInteraction).message.id)
                .catch(() => void 0);
            if (msg !== undefined) {
                await msg.edit({
                    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        new StringSelectMenuBuilder()
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setCustomId(
                                Buffer.from(`${ctx.author.id}_${this.meta.name}`)
                                    .toString("base64")
                            )
                            .addOptions(matching)
                            .setPlaceholder("Please select the command")
                            .setDisabled(true)
                    )]
                });
            }
        }

        await ctx.send({
            embeds: [this.infoEmbed
                .setAuthor({
                    name: `${this.client.user?.username} - Information about ${command.meta.name} command`,
                    iconURL: this.client.user?.displayAvatarURL()
                })
                .addFields(
                    { name: "Name", value: `**\`${command.meta.name}\`**`, inline: false },
                    { name: "Description", value: command.meta.description ?? "", inline: true },
                    {
                        name: "Aliases",
                        value: command.meta.aliases && (command.meta.aliases.length > 0)
                            ? command.meta.aliases.map(c => `**\`${c}\`**`).join(", ")
                            : "None",
                        inline: false
                    },
                    { name: "Usage", value: `**\`${(command.meta.usage ?? "").replaceAll("{prefix}", this.client.config.prefix)}\`**`, inline: true }
                )
                .setFooter({
                    text: `<> = required | [] = optional ${command.meta.devOnly === true ? "(developer-only command)" : ""}`,
                    iconURL: "https://cdn.stegripe.org/images/information.png"
                })]
        }, "editReply");
    }

    private generateSelectMenu(cmd: string, author: string): SelectMenuComponentOptionData[] {
        const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
        const matching = [...this.client.commands.values()].filter(x => {
            const isDev = this.client.config.devs.includes(author);
            if (isDev) return x.meta.name.includes(cmd);
            return x.meta.name.includes(cmd) && x.meta.devOnly !== true;
        }).slice(0, 10).map((x, i) => (
            {
                label: x.meta.name,
                emoji: emojis[i],
                description: x.meta.description !== undefined && x.meta.description.length > 47 ? `${x.meta.description.slice(0, 47)}...` : x.meta.description ?? "",
                value: x.meta.name
            }
        ));
        return matching;
    }
}
