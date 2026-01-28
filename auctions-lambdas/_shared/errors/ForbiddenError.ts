import { HttpError } from './HttpError';

export class ForbiddenError extends HttpError {
	constructor(message = 'Forbidden') {
		super(message, 403);
	}
}
