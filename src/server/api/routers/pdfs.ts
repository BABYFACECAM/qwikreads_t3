import { z } from "zod";

import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";

export const pdfRouter = createTRPCRouter({
  // Upload a new PDF
  uploadPdf: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        file: z.string().format("binary"),
        isPublic: z.boolean(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Store the uploaded file on disk
      const filePath = await storePdfFile(input.file);

      // Extract the cover image and tags from the PDF
      const { coverImage, tags } = await extractPdfMetadata(filePath);

      // Create a new PDF record in the database
      const pdf = await ctx.prisma.pdf.create({
        data: {
          name: input.name,
          url: filePath,
          isPublic: input.isPublic,
          tags: tags ?? undefined,
          coverImage: coverImage ?? undefined,
          user: { connect: { id: ctx.user?.id } },
        },
      });

      return pdf;
    }),

  // Get a list of PDFs that belong to the current user
  getMyPdfs: protectedProcedure.query(async ({ ctx }) => {
    const pdfs = await ctx.prisma.pdf.findMany({
      where: { userId: ctx.user?.id },
    });
    return pdfs;
  }),

  // Get a list of public PDFs
  getPublicPdfs: publicProcedure.query(async ({ ctx }) => {
    const pdfs = await ctx.prisma.pdf.findMany({ where: { isPublic: true } });
    return pdfs;
  }),

  // Get the contents of a PDF
  readPdf: protectedProcedure
    .input(z.object({ pdfId: z.string() }))
    .query(async ({ input, ctx }) => {
      const pdf = await ctx.prisma.pdf.findUnique({
        where: { id: input.pdfId },
      });

      if (!pdf) throw new TRPCError({ code: "NOT_FOUND" });

      const contents = await readPdfFile(pdf.url);
      return contents;
    }),
});
