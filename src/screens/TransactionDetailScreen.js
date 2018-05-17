import React, { Component, Fragment } from 'react'
import {
	SafeAreaView, View, Text, Alert,
	Clipboard, ActivityIndicator,
	TouchableOpacity, ScrollView, Linking, Picker
} from 'react-native'
import { TabViewAnimated, TabBar, SceneMap } from 'react-native-tab-view'
import Button from 'react-native-micro-animated-button'
import Icon from 'react-native-vector-icons/Feather'
import ActionSheet from 'react-native-actionsheet'
import { observer, inject } from 'mobx-react'
import SInfo from 'react-native-sensitive-info';
import { List, ListItem, Card } from 'react-native-elements'
import uuid from 'uuid/v4'
import bip39 from 'bip39'
import base64 from 'base-64'
import base64js from 'base64-js'
import crypto from 'crypto-js'
import sha256 from 'crypto-js/sha256';
import { get, sortBy } from 'lodash'
import { generateTronKeypair } from './../utils/bipUtil';
import { signDataTransaction } from "../utils/transactionUtil";
import PouchDB from 'pouchdb-react-native'
import SQLite from 'react-native-sqlite-2'
import SQLiteAdapterFactory from 'pouchdb-adapter-react-native-sqlite'
import {
	Screen,
	ContainerFlex,
	Container,
	Header,
	Title,
	TitleWrapper,
	LoadButtonWrapper,
	LoadButton
} from './styled';
import styled from 'styled-components';

const DetailBox = styled.View`
width: 90%;
height: auto;
flex-direction: column;
justify-content: flex-start;
background-color: white;
`

const DetailRow = styled.View`
flex-direction: row;
justify-content: space-between;
`
const DetailLabel = styled.Text`
font-size: 15px;
margin: 6px;
font-weight: bold;
color: #2e3666;
`
const DetailText = styled.Text`
font-size: 15px;
margin: 6px;
`

const SQLiteAdapter = SQLiteAdapterFactory(SQLite)
PouchDB.plugin(SQLiteAdapter)
const db = new PouchDB('Secrets', { adapter: 'react-native-sqlite' })
const db2 = new PouchDB('Transactions', { adapter: 'react-native-sqlite' })

@inject('appStore') @observer
class TransactionDetail extends Component {

	static navigationOptions = ({ navigation }) => {
		const params = navigation.state.params || {};

		return {
			header: (
				<SafeAreaView style={{ backgroundColor: '#2e3666' }}>
					<Header>
						<TitleWrapper>
							<Title>Transaction Detail</Title>
						</TitleWrapper>
						<LoadButtonWrapper>
							<LoadButton onPress={() => navigation.navigate('Home')}>
								<Icon name="x-circle" color="white" size={32} />
							</LoadButton>
						</LoadButtonWrapper>
					</Header>
				</SafeAreaView>
			)
		};
	};

	state = {
		tabView: {
			index: 0,
			routes: [
				{ key: 'display', title: 'Operation' },
				{ key: 'envelop', title: 'Envelope' },
				{ key: 'signed', title: 'Signed' }
			]
		},
		secrets: [],
		options: [],
		secretSelected: null,
		showSecurityForm: false,
		loadingSign: false,
		loadingData: true,
		transactionDetail: null,
		isSigned: false,
		pk: '',
		transactionSigned: '',
	}

	componentDidMount() {
		const { appStore } = this.props;
		this.loadData();
	}

	loadData = async () => {
		const { appStore } = this.props;
		const currentTransaction = appStore.get('currentTransaction');
		let transactionDetail = {};
		try {
			const pkFromQR = currentTransaction.pk;
			const transactionDetail = currentTransaction.txDetails;
			// //TODO 
			db.allDocs({
				include_docs: true
			}).then((res) => {
				const options = [];
				const secrets = res.rows;
				secrets.forEach(el => options.push(el.doc.alias));
				let secretFromQR = null;
				if (secrets.length) {
					secretFromQR = secrets.find(el => el.doc.pk === pkFromQR);
				}

				this.setState({
					secrets,
					transactionDetail,
					options,
					secretSelected: secretFromQR,
					loadingData: false,
				});
			})
		} catch (error) {
			alert(error.message);
			this.setState({ loadingData: false });
		}
	}

	// copyToClipboard = () => {
	// 	const { appStore, navigation } = this.props
	// 	const tx = appStore.get('currentTransaction')
	// 	Clipboard.setString(tx.xdr);
	// 	alert('The signed xdr was copied to the clipboard.');
	// }

	// handleTabIndexChange = index => {
	// 	this.setState({
	// 		tabView: Object.assign({}, this.state.tabView, {
	// 			index
	// 		})
	// 	})
	// }

	// signTransaction = () => {
	// 	this.authTransaction();
	// }

	// authTransaction = () => {
	// 	const { appStore, navigation } = this.props
	// 	const seed = appStore.get('seed')

	// 	const { secrets, options } = this.state;
	// 	if (!secrets || secrets.length === 0) {
	// 		Alert.alert(
	// 			`You don't have any secret!`,
	// 			`Please, add a new secret on the secrets tab.`,
	// 			[
	// 				{
	// 					text: 'Ok',
	// 					onPress: () => navigation.goBack()
	// 				}
	// 			]
	// 		)
	// 	} else {
	// 		this.actionSheet.show();
	// 	}
	// }

	// rejectTransaction = () => {
	// 	const { appStore, navigation } = this.props
	// 	const currentTransaction = appStore.get('currentTransaction')
	// 	try {
	// 		db2.put({
	// 			_id: currentTransaction._id,
	// 			...currentTransaction,
	// 			status: 'REJECTED'
	// 		});
	// 		navigation.goBack()
	// 		setTimeout(() => {
	// 			appStore.set('currentTransaction', undefined)
	// 		}, 1000)
	// 	} catch (error) {
	// 		alert(error.message)
	// 	}
	// }

	deleteTransaction = async () => {
		const { appStore, navigation } = this.props
		const currentTransaction = appStore.get('currentTransaction');
		try {
			const res = await db2.remove(currentTransaction);
			navigation.goBack()
			setTimeout(() => {
				appStore.set('currentTransaction', undefined)
			}, 1000)
		} catch (error) {
			alert(error.message);
		}
	}

	// showConfirmDelete = tx => {
	// 	Alert.alert(
	// 		`Are you sure you want delete this?`,
	// 		`${tx.memo}`,
	// 		[
	// 			{ text: 'Cancel', onPress: () => { }, style: 'cancel' },
	// 			{
	// 				text: 'Confirm',
	// 				onPress: () => this.deleteTransaction(tx)
	// 			}
	// 		],
	// 		{ cancelable: true }
	// 	)
	// }


	submitSignature = index => {
		const { secrets, secretSelected } = this.state;
		const secret = secrets[index]

		this.showConfirmSignatureAlert(secretSelected)
	}

	handleSignPress = () => {
		const { appStore } = this.props
		const { isSigned, secretSelected } = this.state;
		const currentTransaction = appStore.get('currentTransaction');
		const { status } = currentTransaction;

		if (isSigned) this.submitTransaction();
		else if (status === 'SUBMITTED') this.retrySubmit();
		else this.confirmSignTransaction(secretSelected.doc);
	}


	confirmSignTransaction = async secret => {
		const { appStore, navigation } = this.props
		const currentTransaction = appStore.get('currentTransaction');
		try {
			const seed = appStore.get('seed');

			const keypair = generateTronKeypair(seed, secret.vn);
			const pk = keypair.base58Address;
			const sk = keypair.privateKey;

			const transactionString = currentTransaction.data;
			const transactionSignedString = await signDataTransaction(sk, transactionString);

			this.setState({ pk, transactionSigned: transactionSignedString, isSigned: true }, this.signButton.reset());
			return;
		} catch (error) {
			alert(error.message || error);
			navigation.navigate('Home');
		} finally {
			this.signButton.reset();
		}
	}

	submitTransaction = async () => {
		const { appStore, navigation } = this.props
		const { pk, transactionSigned } = this.state;
		const currentTransaction = appStore.get('currentTransaction')

		const tx = {
			...currentTransaction,
			pk,
			transactionSigned,
			status: 'SUBMITTED',
			createdAt: new Date().toISOString()
		};

		try {
			currentTransaction.URL += `/${pk}/${transactionSigned}?#${Date.now()}`;
			const supported = await Linking.canOpenURL(currentTransaction.URL)
			await db2.put({ _id: uuid(), ...tx });
			if (supported) Linking.openURL(currentTransaction.URL);
			this.signButton.success();
			navigation.navigate('Home');

		} catch (error) {
			alert(error.message)
			this.signButton.reset();
		}
		return;
	}

	retrySubmit = async () => {
		const { appStore, navigation } = this.props
		const currentTransaction = appStore.get('currentTransaction')
		try {
			const { pk, transactionSigned, URL } = currentTransaction;
			URL += `/${pk}/${transactionSigned}?#${Date.now()}`;
			alert(URL);

			const supported = await Linking.canOpenURL(URL)
			if (supported) Linking.openURL(URL);

			this.signButton.success();
			navigation.navigate('Home');
		} catch (error) {
			alert(error.message)
			this.signButton.reset();
		}

	}

	// saveCurrentTransaction = data => {
	// 	const { appStore } = this.props
	// 	const currentTransaction = appStore.get('currentTransaction')
	// 	if (data) {
	// 		if (data.type === 'error') {
	// 			//console.warn('Error: ', data);
	// 			this.saveTransaction({
	// 				xdr: data.xdr,
	// 				createdAt: new Date().toISOString(),
	// 				type: 'error',
	// 				message: data.message,
	// 				status: 'ERROR'
	// 			})
	// 		} else if (data.type === 'sign') {
	// 			this.saveTransaction({
	// 				...currentTransaction,
	// 				...data,
	// 				status: 'SIGNED',
	// 				createdAt: new Date().toISOString()
	// 			})
	// 		} else {
	// 			const tx = parseEnvelopeTree(data.tx)
	// 			this.saveTransaction({
	// 				...tx,
	// 				type: data.type,
	// 				xdr: data.xdr,
	// 				createdAt: new Date().toISOString(),
	// 				status: 'CREATED'
	// 			})
	// 		}
	// 	} else {
	// 		console.warn('Data not found!');
	// 	}
	// }

	// saveTransaction = async tx => {
	// 	const { appStore } = this.props
	// 	try {
	// 		db2.put({
	// 			_id: uuid(),
	// 			...tx
	// 		});
	// 	} catch (error) {
	// 		alert(error.message)
	// 	}
	// 	appStore.set('currentXdr', undefined)
	// }



	// showConfirmSignatureAlert = secret => {
	// 	if (secret && secret.doc) {
	// 		Alert.alert(
	// 			`${secret.doc.alias}`,
	// 			`${secret.doc.pk}`,
	// 			[
	// 				{ text: 'Cancel', onPress: () => { }, style: 'cancel' },
	// 				{
	// 					text: 'Confirm the transaction',
	// 					onPress: () => this.confirmSignTransaction(secret.doc)
	// 				}
	// 			],
	// 			{ cancelable: true }
	// 		)
	// 	} else {
	// 		Alert.alert('You don`t have secrets seleceted');
	// 	}
	// }

	renderTxDetail = () => {
		const { transactionDetail, secretSelected, isSigned } = this.state;
		const { appStore } = this.props;
		const currentTransaction = appStore.get('currentTransaction');
		//If submited then it was signed
		const signedStatus = isSigned || currentTransaction.status === 'SUBMITTED';
		const submitedStatus = currentTransaction.status === 'SUBMITTED';

		let details = [];

		details.push(<ListItem
			rightTitleStyle={{ color: '#383838' }}
			hideChevron
			key={'account'}
			title={'Account'}
			titleStyle={{ color: '#2e3666', fontWeight: '600' }}
			rightTitle={secretSelected.doc.alias.toString()}
		/>)
		for (let detail in transactionDetail) {
			details.push(<ListItem
				rightTitleStyle={{ color: '#383838' }}
				rightTitleContainerStyle={2}
				hideChevron
				key={detail}
				title={detail.toString()}
				titleStyle={{ color: '#2e3666', fontWeight: '600' }}
				rightTitle={transactionDetail[detail].toString()}
			/>)
		}
		details.push(
			<ListItem
				rightTitleStyle={{ color: '#383838' }}
				key={'signed'}
				titleStyle={{ color: '#2e3666', fontWeight: '600' }}
				title="Signed"
				rightIcon={signedStatus ?
					<Icon name="check" color="green" size={20} /> :
					<Icon name="x" color="red" size={20} />}
			/>
			, <ListItem
				rightTitleStyle={{ color: '#383838' }}
				key={'submitted'}
				titleStyle={{ color: '#2e3666', fontWeight: '600' }}
				title="Submitted"
				rightIcon={
					submitedStatus ?
						<Icon name="check" color="green" size={20} /> :
						<Icon name="x" color="red" size={20} />}
			/>);

		return <List containerStyle={{ margin: 0 }} title="Contract Data">
			{details}
		</List>;
	}
	render() {
		const { appStore, toggleModal } = this.props
		const { secretSelected, loadingData, transactionDetail, isSigned } = this.state
		const securityFormError = appStore.get('securityFormError');
		const currentTransaction = appStore.get('currentTransaction');
		let isSubmitted = false;

		if (currentTransaction) {
			isSubmitted = currentTransaction.status === 'SUBMITTED';
		}

		if (loadingData) {
			return <ActivityIndicator size="large" color="#0000ff" />
		}
		if (!secretSelected) {
			return (<ContainerFlex style={{ backgroundColor: '#d5eef7', justifyContent: 'center', padding: 0 }}>
				<Text
					style={{
						fontWeight: 'bold',
						fontSize: 15,
						alignSelf: 'center',
						color: '#2e3666',
					}}
				> There is not secret bounded to this transaction</Text>
			</ContainerFlex>
			)
		}
		return (
			<ContainerFlex style={{ backgroundColor: '#ffffff' }}>
				<Text style={{ alignSelf: 'center', marginTop: 10, paddingBottom: 0, color: '#3e3666', fontWeight: '500' }}>Contract Data</Text>
				{transactionDetail && this.renderTxDetail()}
				{!isSubmitted && !isSigned && <Button
					onPress={this.handleSignPress}
					ref={ref => (this.signButton = ref)}
					foregroundColor={'white'}
					backgroundColor={isSigned ? 'blue' : '#4cd964'}
					successColor={'#4cd964'}
					errorColor={'#ff3b30'}
					errorIconColor={'white'}
					successIconColor={'white'}
					successIconName="check"
					label={"Sign"}
					maxWidth={100}
					style={{ marginLeft: 16, borderWidth: 0, alignSelf: 'center' }}
				/>}
				{!isSubmitted && isSigned && < Button
					onPress={this.handleSignPress}
					ref={ref => (this.signButton = ref)}
					foregroundColor={'white'}
					backgroundColor={'#0046b7'}
					successColor={'#4cd964'}
					errorColor={'#ff3b30'}
					errorIconColor={'white'}
					successIconColor={'white'}
					successIconName="check"
					label={"Submit"}
					maxWidth={150}
					style={{ marginLeft: 16, borderWidth: 0, alignSelf: 'center' }}
				/>}
				{isSubmitted && <Fragment>
					< Button
						onPress={this.deleteTransaction}
						ref={ref => (this.deleteButton = ref)}
						foregroundColor={'white'}
						backgroundColor={'#ff3b30'}
						successColor={'#4cd964'}
						errorColor={'#ff3b30'}
						errorIconColor={'white'}
						successIconColor={'white'}
						successIconName="check"
						label={"Delete"}
						maxWidth={150}
						style={{ marginLeft: 16, borderWidth: 0, alignSelf: 'center' }}
					/>
				</Fragment>}

			</ContainerFlex>
		)
	}
}

export default TransactionDetail
