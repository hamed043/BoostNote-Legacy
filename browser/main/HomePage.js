import React, { PropTypes} from 'react'
import { connect } from 'react-redux'
import { CREATE_MODE, EDIT_MODE, IDLE_MODE, NEW, toggleTutorial } from 'boost/actions'
// import UserNavigator from './HomePage/UserNavigator'
import ArticleNavigator from './HomePage/ArticleNavigator'
import ArticleTopBar from './HomePage/ArticleTopBar'
import ArticleList from './HomePage/ArticleList'
import ArticleDetail from './HomePage/ArticleDetail'
import _ from 'lodash'
import keygen from 'boost/keygen'
import { isModalOpen, closeModal } from 'boost/modal'

const TEXT_FILTER = 'TEXT_FILTER'
const FOLDER_FILTER = 'FOLDER_FILTER'
const FOLDER_EXACT_FILTER = 'FOLDER_EXACT_FILTER'
const TAG_FILTER = 'TAG_FILTER'

class HomePage extends React.Component {
  componentDidMount () {
    // React自体のKey入力はfocusされていないElementからは動かないため、
    // `window`に直接かける
    this.keyHandler = e => this.handleKeyDown(e)
    window.addEventListener('keydown', this.keyHandler)
  }

  componentWillUnmount () {
    window.removeEventListener('keydown', this.keyHandler)
  }

  handleKeyDown (e) {
    if (isModalOpen()) {
      if (e.keyCode === 27) closeModal()
      return
    }

    let { status, dispatch } = this.props
    let { nav, top, list, detail } = this.refs

    if (status.isTutorialOpen) {
      dispatch(toggleTutorial())
      e.preventDefault()
      return
    }

    // Search inputがfocusされていたら大体のキー入力は無視される。
    if (top.isInputFocused() && !e.metaKey) {
      if (e.keyCode === 13 || e.keyCode === 27) top.escape()
      return
    }

    switch (status.mode) {
      case CREATE_MODE:
      case EDIT_MODE:
        if (e.keyCode === 27) {
          detail.handleCancelButtonClick()
        }
        if ((e.keyCode === 13 && e.metaKey) || (e.keyCode === 83 && e.metaKey)) {
          detail.handleSaveButtonClick()
        }
        break
      case IDLE_MODE:
        if (e.keyCode === 69) {
          detail.handleEditButtonClick()
          e.preventDefault()
        }
        if (e.keyCode === 68) {
          detail.handleDeleteButtonClick()
        }

        // `detail`の`openDeleteConfirmMenu`の時。
        if (detail.state.openDeleteConfirmMenu) {
          if (e.keyCode === 27) {
            detail.handleDeleteCancelButtonClick()
          }
          if (e.keyCode === 13 && e.metaKey) {
            detail.handleDeleteConfirmButtonClick()
          }
          break
        }

        // `detail`の`openDeleteConfirmMenu`が`true`なら呼ばれない。
        if (e.keyCode === 27 || (e.keyCode === 70 && e.metaKey)) {
          top.focusInput()
        }

        if (e.keyCode === 38) {
          list.selectPriorArticle()
        }

        if (e.keyCode === 40) {
          list.selectNextArticle()
        }

        if (e.keyCode === 65 || e.keyCode === 13 && e.metaKey) {
          nav.handleNewPostButtonClick()
          e.preventDefault()
        }
    }
  }

  render () {
    let { dispatch, status, articles, allArticles, activeArticle, folders, filters } = this.props

    return (
      <div className='HomePage'>
        <ArticleNavigator
          ref='nav'
          dispatch={dispatch}
          folders={folders}
          status={status}
          allArticles={allArticles}
        />
        <ArticleTopBar
          ref='top'
          dispatch={dispatch}
          status={status}
        />
        <ArticleList
          ref='list'
          dispatch={dispatch}
          folders={folders}
          articles={articles}
          status={status}
          activeArticle={activeArticle}
        />
        <ArticleDetail
          ref='detail'
          dispatch={dispatch}
          activeArticle={activeArticle}
          folders={folders}
          status={status}
          filters={filters}
        />
      </div>
    )
  }
}

// Ignore invalid key
function ignoreInvalidKey (key) {
  return key.length > 0 && !key.match(/^\/\/$/) && !key.match(/^\/$/) && !key.match(/^#$/)
}

// Build filter object by key
function buildFilter (key) {
  if (key.match(/^\/\/.+/)) {
    return {type: FOLDER_EXACT_FILTER, value: key.match(/^\/\/(.+)$/)[1]}
  }
  if (key.match(/^\/.+/)) {
    return {type: FOLDER_FILTER, value: key.match(/^\/(.+)$/)[1]}
  }
  if (key.match(/^#(.+)/)) {
    return {type: TAG_FILTER, value: key.match(/^#(.+)$/)[1]}
  }
  return {type: TEXT_FILTER, value: key}
}

function remap (state) {
  let { folders, articles, status } = state

  if (articles == null) articles = []
  articles.sort((a, b) => {
    return new Date(b.updatedAt) - new Date(a.updatedAt)
  })
  let allArticles = articles.slice()

  // Filter articles
  let filters = status.search.split(' ')
    .map(key => key.trim())
    .filter(ignoreInvalidKey)
    .map(buildFilter)

  let folderExactFilters = filters.filter(filter => filter.type === FOLDER_EXACT_FILTER)
  let folderFilters = filters.filter(filter => filter.type === FOLDER_FILTER)
  let textFilters = filters.filter(filter => filter.type === TEXT_FILTER)
  let tagFilters = filters.filter(filter => filter.type === TAG_FILTER)

  let targetFolders
  if (folders != null) {
    let exactTargetFolders = folders.filter(folder => {
      return _.find(folderExactFilters, filter => folder.name.match(new RegExp(`^${filter.value}$`)))
    })
    let fuzzyTargetFolders = folders.filter(folder => {
      return _.find(folderFilters, filter => folder.name.match(new RegExp(`^${filter.value}`)))
    })
    targetFolders = status.targetFolders = exactTargetFolders.concat(fuzzyTargetFolders)

    if (targetFolders.length > 0) {
      articles = articles.filter(article => {
        return _.findWhere(targetFolders, {key: article.FolderKey})
      })
    }

    if (textFilters.length > 0) {
      articles = textFilters.reduce((articles, textFilter) => {
        return articles.filter(article => {
          return article.title.match(new RegExp(textFilter.value, 'i')) || article.content.match(new RegExp(textFilter.value, 'i'))
        })
      }, articles)
    }

    if (tagFilters.length > 0) {
      articles = tagFilters.reduce((articles, tagFilter) => {
        return articles.filter(article => {
          return _.find(article.tags, tag => tag.match(new RegExp(tagFilter.value, 'i')))
        })
      }, articles)
    }
  }

  // Grab active article
  let activeArticle = _.findWhere(articles, {key: status.articleKey})
  if (activeArticle == null) activeArticle = articles[0]

  // remove Unsaved new article if user is not CREATE_MODE
  if (status.mode !== CREATE_MODE) {
    let targetIndex = _.findIndex(articles, article => article.status === NEW)

    if (targetIndex >= 0) articles.splice(targetIndex, 1)
  }

  // switching CREATE_MODE
  // restrict
  // 1. team have one folder at least
  // or Change IDLE MODE
  if (status.mode === CREATE_MODE) {
    let newArticle = _.findWhere(articles, {status: 'NEW'})
    console.log('targetFolders')
    let FolderKey = targetFolders.length > 0
      ? targetFolders[0].key
      : folders[0].key

    if (newArticle == null) {
      newArticle = {
        id: null,
        key: keygen(),
        title: '',
        content: '',
        mode: 'markdown',
        tags: [],
        FolderKey: FolderKey,
        status: NEW
      }
      articles.unshift(newArticle)
    }
    activeArticle = newArticle
  } else if (status.mode === CREATE_MODE) {
    status.mode = IDLE_MODE
  }

  return {
    folders,
    status,
    allArticles,
    articles,
    activeArticle,
    filters: {
      folder: folderFilters,
      tag: tagFilters,
      text: textFilters
    }
  }
}

HomePage.propTypes = {
  params: PropTypes.shape({
    userId: PropTypes.string
  }),
  status: PropTypes.shape({
    userId: PropTypes.string
  }),
  articles: PropTypes.array,
  allArticles: PropTypes.array,
  activeArticle: PropTypes.shape(),
  dispatch: PropTypes.func,
  folders: PropTypes.array,
  filters: PropTypes.shape({
    folder: PropTypes.array,
    tag: PropTypes.array,
    text: PropTypes.array
  })
}

export default connect(remap)(HomePage)