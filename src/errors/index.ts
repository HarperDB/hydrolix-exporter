export class HydrolixResourceNotFoundError extends Error {
	statusCode: number;

	constructor(message: string = 'Hydrolix resource not found') {
		super(message);
		this.name = 'HydrolixResourceNotFound';
		this.statusCode = 404;

		Object.setPrototypeOf(this, HydrolixResourceNotFoundError.prototype);
	}
}

export class HydrolixAuthenticationError extends Error {
	statusCode: number;

	constructor(message: string = 'Could not log in') {
		super(message);
		this.name = 'HydrolixAuthentication';
		this.statusCode = 401;

		Object.setPrototypeOf(this, HydrolixAuthenticationError.prototype);
	}
}

export class BadRequestError extends Error {
	statusCode: number;

	constructor(message: string = 'Request input not allowed') {
		super(message);
		this.name = 'BadRequest';
		this.statusCode = 400;

		Object.setPrototypeOf(this, BadRequestError.prototype);
	}
}
