import { StatusCodes } from 'http-status-codes';
import slugify from 'slugify';
import ApiError from '../../../errors/ApiError';
import { ILegalPage } from './legal.interface';
import { LegalPage } from './legal.model';

const generateSlug = async (title: string): Promise<string> => {
  const slug = slugify(title, { lower: true, strict: true });
  const existing = await LegalPage.findOne({ slug });
  if (existing) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'A legal page with this title already exists',
    );
  }
  return slug;
};

const createLegalPage = async (
  payload: Partial<ILegalPage>,
): Promise<ILegalPage> => {
  if (!payload.title) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Title is required');
  }
  const slug = await generateSlug(payload.title);
  await LegalPage.create({ ...payload, slug });
  const result = await LegalPage.findOne({ slug }).select(
    'slug title content createdAt',
  );
  return result as ILegalPage;
};

const getAll = async (): Promise<ILegalPage[]> => {
  const result = await LegalPage.find()
    .select('-_id slug title')
    .sort({ title: 1 });
  return result;
};

const getBySlug = async (slug: string): Promise<ILegalPage> => {
  const result = await LegalPage.findOne({ slug }).select(
    '-_id slug title content updatedAt',
  );
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Legal page not found');
  }
  return result;
};

const updateBySlug = async (
  slug: string,
  payload: Partial<ILegalPage>,
): Promise<ILegalPage> => {
  const updateData: Partial<ILegalPage> = {};

  if (payload.title) {
    const newSlug = await generateSlug(payload.title);
    updateData.title = payload.title;
    updateData.slug = newSlug;
  }
  if (payload.content) {
    updateData.content = payload.content;
  }

  const result = await LegalPage.findOneAndUpdate({ slug }, updateData, {
    new: true,
  }).select('slug title content updatedAt');
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Legal page not found');
  }
  return result;
};

const deleteBySlug = async (slug: string): Promise<void> => {
  const existing = await LegalPage.findOne({ slug });
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Legal page not found');
  }
  await LegalPage.findOneAndDelete({ slug });
};

export const LegalService = {
  createLegalPage,
  getAll,
  getBySlug,
  updateBySlug,
  deleteBySlug,
};
